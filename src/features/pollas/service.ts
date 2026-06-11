import 'server-only'
import { getDb, nowIso } from '@/shared/db/client'
import type { Polla } from '@/shared/types/domain'

interface PollaRow {
  id: number
  name: string
  admin_user_id: number | null
}

function rowToPolla(r: PollaRow): Polla {
  return { id: r.id, name: r.name, adminUserId: r.admin_user_id }
}

export async function getPolla(id: number): Promise<Polla | null> {
  const db = await getDb()
  const rows = await db.query<PollaRow>(
    'SELECT id, name, admin_user_id FROM pollas WHERE id = $1',
    [id]
  )
  return rows[0] ? rowToPolla(rows[0]) : null
}

export async function listPollas(): Promise<Polla[]> {
  const db = await getDb()
  const rows = await db.query<PollaRow>(
    'SELECT id, name, admin_user_id FROM pollas ORDER BY id'
  )
  return rows.map(rowToPolla)
}

export interface PollaStats extends Polla {
  adminName: string | null
  entryCount: number
  userCount: number
  /** Código de la invitación de admin aún sin usar (para copiar el link) */
  pendingAdminCode: string | null
}

export async function listPollasWithStats(): Promise<PollaStats[]> {
  const db = await getDb()
  const rows = await db.query<
    PollaRow & {
      admin_name: string | null
      entry_count: number
      user_count: number
      pending_admin_code: string | null
    }
  >(
    `SELECT p.id, p.name, p.admin_user_id,
            au.display_name AS admin_name,
            (SELECT COUNT(*)::int FROM entries e WHERE e.polla_id = p.id) AS entry_count,
            (SELECT COUNT(DISTINCT ue.user_id)::int FROM user_entries ue
              JOIN entries e ON e.id = ue.entry_id WHERE e.polla_id = p.id) AS user_count,
            (SELECT i.code FROM invites i
              WHERE i.polla_id = p.id AND i.grants_admin = 1 AND i.revoked = 0
                AND i.entry_id IS NULL
              ORDER BY i.created_at DESC LIMIT 1) AS pending_admin_code
     FROM pollas p
     LEFT JOIN users au ON au.id = p.admin_user_id
     ORDER BY p.id`
  )

  return rows.map((r) => ({
    ...rowToPolla(r),
    adminName: r.admin_name,
    entryCount: r.entry_count,
    userCount: r.user_count,
    pendingAdminCode: r.admin_user_id === null ? r.pending_admin_code : null,
  }))
}

/** Crea una polla nueva; el admin se designa con una invitación grants_admin */
export async function createPolla(name: string): Promise<Polla> {
  const db = await getDb()
  const trimmed = name.trim()
  const rows = await db.query<{ id: number }>(
    'INSERT INTO pollas (name, created_at) VALUES ($1, $2) RETURNING id',
    [trimmed, nowIso()]
  )
  return { id: rows[0].id, name: trimmed, adminUserId: null }
}

export async function isPollaAdmin(userId: number, pollaId: number): Promise<boolean> {
  const db = await getDb()
  const rows = await db.query(
    'SELECT 1 FROM pollas WHERE id = $1 AND admin_user_id = $2',
    [pollaId, userId]
  )
  return rows.length > 0
}

export interface DeletePollaResult {
  ok: boolean
  error?: string
}

/**
 * Elimina una polla completa (solo el superadmin). Cascada manual en una
 * transacción porque las FKs no la declaran:
 *  - los miembros que también juegan en OTRA polla se mueven a esa entrada
 *  - los que solo jugaban aquí (no superadmin) se eliminan con sus datos
 *  - se borran invitaciones, entradas, pronósticos y premios de la polla
 * No permite borrar la última polla ni dejar al superadmin sin ninguna.
 */
export async function deletePolla(pollaId: number): Promise<DeletePollaResult> {
  const db = await getDb()
  return db.transaction(async (tx): Promise<DeletePollaResult> => {
    const polla = (await tx.query('SELECT id FROM pollas WHERE id = $1', [pollaId]))[0]
    if (!polla) return { ok: false, error: 'La polla no existe' }

    const total = (
      await tx.query<{ n: number }>('SELECT COUNT(*)::int AS n FROM pollas')
    )[0].n
    if (total <= 1) return { ok: false, error: 'No puedes borrar la única polla' }

    // Miembros de la polla (cuentas con membresía en alguna de sus entradas)
    const members = await tx.query<{ user_id: number; is_superadmin: number }>(
      `SELECT DISTINCT u.id AS user_id, u.is_superadmin FROM users u
       JOIN user_entries ue ON ue.user_id = u.id
       JOIN entries e ON e.id = ue.entry_id
       WHERE e.polla_id = $1`,
      [pollaId]
    )

    const orphans: number[] = []
    for (const m of members) {
      const other = (
        await tx.query<{ entry_id: number }>(
          `SELECT ue.entry_id FROM user_entries ue
           JOIN entries e ON e.id = ue.entry_id
           WHERE ue.user_id = $1 AND e.polla_id <> $2 LIMIT 1`,
          [m.user_id, pollaId]
        )
      )[0]
      if (other) {
        // Si su entrada activa está en esta polla, moverla a la otra membresía
        await tx.query(
          `UPDATE users SET entry_id = $1
           WHERE id = $2 AND entry_id IN (SELECT id FROM entries WHERE polla_id = $3)`,
          [other.entry_id, m.user_id, pollaId]
        )
      } else if (m.is_superadmin === 1) {
        return {
          ok: false,
          error: 'No puedes borrar esta polla: dejaría al superadmin sin ninguna polla',
        }
      } else {
        orphans.push(m.user_id)
      }
    }

    // Invitaciones de la polla (referencian polla_id y entry_id, sin cascade)
    await tx.query('DELETE FROM invites WHERE polla_id = $1', [pollaId])

    // Cuentas que solo jugaban aquí: soltar admin_user_id y borrarlas
    for (const id of orphans) {
      await tx.query('UPDATE pollas SET admin_user_id = NULL WHERE admin_user_id = $1', [id])
      await tx.query('DELETE FROM users WHERE id = $1', [id])
    }

    // Entradas de la polla (cascade: predictions, award_picks, user_entries)
    await tx.query('DELETE FROM entries WHERE polla_id = $1', [pollaId])

    await tx.query('DELETE FROM pollas WHERE id = $1', [pollaId])
    return { ok: true }
  })
}
