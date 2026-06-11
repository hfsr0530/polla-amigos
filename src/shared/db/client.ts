import { SCHEMA_SQL } from './schema'

// Capa de datos Postgres con dos runtimes:
//  - Neon (@neondatabase/serverless) cuando hay DATABASE_URL → producción
//  - PGlite (Postgres embebido, WASM) sin DATABASE_URL → dev local y tests
// Misma interfaz async en ambos; el resto de la app no sabe cuál corre.

export interface DbClient {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>
  transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T>
}

export function nowIso(): string {
  return new Date().toISOString()
}

interface QueryableLike {
  query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }>
}

function wrapQueryable(q: QueryableLike): DbClient {
  return {
    async query<T>(text: string, params?: unknown[]): Promise<T[]> {
      const result = await q.query(text, params)
      return result.rows as T[]
    },
    // Ya dentro de una transacción: las llamadas anidadas comparten el contexto
    async transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T> {
      return fn(wrapQueryable(q))
    },
  }
}

async function runSchema(db: DbClient): Promise<void> {
  for (const statement of SCHEMA_SQL.split(';')) {
    const sql = statement.trim()
    if (sql) await db.query(sql)
  }
}

async function createNeonClient(connectionString: string): Promise<DbClient> {
  const { Pool, neonConfig } = await import('@neondatabase/serverless')
  // El Pool de Neon usa WebSockets para las transacciones interactivas.
  // Node 22+ trae WebSocket global; en versiones previas recurrimos a `ws`.
  if (typeof WebSocket === 'undefined') {
    const ws = (await import('ws')).default
    neonConfig.webSocketConstructor = ws as never
  }
  const pool = new Pool({ connectionString })

  const client: DbClient = {
    async query<T>(text: string, params?: unknown[]): Promise<T[]> {
      const result = await pool.query(text, params)
      return result.rows as T[]
    },
    async transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T> {
      const conn = await pool.connect()
      try {
        await conn.query('BEGIN')
        const result = await fn(wrapQueryable(conn))
        await conn.query('COMMIT')
        return result
      } catch (err) {
        await conn.query('ROLLBACK').catch(() => undefined)
        throw err
      } finally {
        conn.release()
      }
    },
  }
  return client
}

async function createPgliteClient(): Promise<DbClient> {
  const { PGlite } = await import('@electric-sql/pglite')
  // Convención heredada de los tests: DATABASE_PATH=':memory:' → efímera
  const inMemory = process.env.DATABASE_PATH === ':memory:'
  const dataDir = process.env.PGLITE_DIR ?? './data/pglite'
  const lite = inMemory ? new PGlite() : new PGlite(dataDir)

  const client: DbClient = {
    async query<T>(text: string, params?: unknown[]): Promise<T[]> {
      const result = await lite.query(text, params)
      return result.rows as T[]
    },
    async transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T> {
      return lite.transaction(async (tx) => fn(wrapQueryable(tx as QueryableLike))) as Promise<T>
    },
  }
  return client
}

const globalForDb = globalThis as unknown as { __pollaDbPromise?: Promise<DbClient> }

async function initDb(): Promise<DbClient> {
  const url = process.env.DATABASE_URL
  const db = url ? await createNeonClient(url) : await createPgliteClient()
  await runSchema(db)
  return db
}

export function getDb(): Promise<DbClient> {
  // Promise como singleton: si dos requests llegan a la vez durante el boot,
  // ambas esperan la misma inicialización (y el schema corre una sola vez)
  if (!globalForDb.__pollaDbPromise) {
    globalForDb.__pollaDbPromise = initDb()
  }
  return globalForDb.__pollaDbPromise
}
