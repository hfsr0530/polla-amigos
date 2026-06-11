import 'server-only'
import { getDb, type DbClient } from '@/shared/db/client'
import { getSetting, setSetting } from '@/shared/db/settings'
import { countPlayers, syncSquads } from '@/features/players/service'
import { normalizeName } from '@/shared/lib/utils'
import type { LivescoreProvider, ProviderMatch, ProviderTeam } from './provider'
import { resolveProviderName } from './provider'
import { createFootballDataProvider } from './providers/footballData'
import { createWorldcup26Provider } from './providers/worldcup26'
import { createEspnProvider } from './providers/espn'

const SYNC_THROTTLE_MS = 60_000 // máx. 1 sync por minuto (respeta rate limits gratuitos)
const IDLE_REFRESH_MS = 6 * 60 * 60_000 // sin partidos cerca: refrescar fixture cada 6 h
const FULL_FIXTURE_THRESHOLD = 90 // menos partidos que esto → falta sembrar el fixture

// Los proveedores nombran distinto a algunas selecciones: sin estos alias el
// cruce por nombre crearía equipos (y partidos) duplicados
const TEAM_ALIASES: Record<string, string> = {
  czechia: 'czech republic',
  'united states': 'usa',
  'united states of america': 'usa',
  'korea republic': 'south korea',
  'ir iran': 'iran',
  turkiye: 'turkey',
  'bosnia and herzegovina': 'bosnia herzegovina',
  'cote divoire': 'ivory coast',
  "cote d'ivoire": 'ivory coast',
}

/** Clave canónica para cruzar equipos entre proveedores */
function teamKey(name: string): string {
  const base = normalizeName(name).replace(/[-_/]/g, ' ').replace(/\s+/g, ' ').trim()
  return TEAM_ALIASES[base] ?? base
}

function getProvider(): LivescoreProvider {
  const name = resolveProviderName()
  if (name === 'football-data') return createFootballDataProvider()
  if (name === 'espn') return createEspnProvider()
  return createWorldcup26Provider()
}

async function upsertTeam(
  tx: DbClient,
  providerName: string,
  team: ProviderTeam
): Promise<number> {
  const externalId = `${providerName}:${team.externalId}`

  const byExternal = await tx.query<{ id: number }>(
    'SELECT id FROM teams WHERE external_id = $1',
    [externalId]
  )
  if (byExternal[0]) {
    await tx.query(
      `UPDATE teams SET name = $1,
         short_name = COALESCE($2, short_name),
         tla = COALESCE($3, tla),
         crest_url = COALESCE($4, crest_url),
         group_name = COALESCE($5, group_name)
       WHERE id = $6`,
      [team.name, team.shortName, team.tla, team.crestUrl, team.groupName, byExternal[0].id]
    )
    return byExternal[0].id
  }

  // Tolerancia a cambio de proveedor: re-usar el equipo si coincide el nombre
  const all = await tx.query<{ id: number; name: string }>('SELECT id, name FROM teams')
  const wanted = teamKey(team.name)
  const byName = all.find((t) => teamKey(t.name) === wanted)
  if (byName) {
    await tx.query(
      `UPDATE teams SET external_id = $1,
         short_name = COALESCE($2, short_name),
         tla = COALESCE($3, tla),
         crest_url = COALESCE($4, crest_url),
         group_name = COALESCE($5, group_name)
       WHERE id = $6`,
      [externalId, team.shortName, team.tla, team.crestUrl, team.groupName, byName.id]
    )
    return byName.id
  }

  const inserted = await tx.query<{ id: number }>(
    `INSERT INTO teams (external_id, name, short_name, tla, crest_url, group_name)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [externalId, team.name, team.shortName, team.tla, team.crestUrl, team.groupName]
  )
  return inserted[0].id
}

async function upsertMatch(
  tx: DbClient,
  providerName: string,
  m: ProviderMatch,
  homeTeamId: number | null,
  awayTeamId: number | null
): Promise<void> {
  const externalId = `${providerName}:${m.externalId}`

  let existing = (
    await tx.query<{ id: number; result_locked: number }>(
      'SELECT id, result_locked FROM matches WHERE external_id = $1',
      [externalId]
    )
  )[0]

  // Cruce entre proveedores: emparejar por etapa + equipos
  if (!existing && homeTeamId !== null && awayTeamId !== null) {
    existing = (
      await tx.query<{ id: number; result_locked: number }>(
        `SELECT id, result_locked FROM matches
         WHERE stage = $1 AND home_team_id = $2 AND away_team_id = $3`,
        [m.stage, homeTeamId, awayTeamId]
      )
    )[0]
  }

  // Eliminatorias: adoptar el cupo "por definir" sembrado por otro proveedor
  // (misma etapa y mismo kickoff) en vez de crear un partido duplicado
  if (!existing) {
    existing = (
      await tx.query<{ id: number; result_locked: number }>(
        `SELECT id, result_locked FROM matches
         WHERE stage = $1 AND kickoff_utc = $2
           AND home_team_id IS NULL AND away_team_id IS NULL
         LIMIT 1`,
        [m.stage, m.kickoffUtc]
      )
    )[0]
  }

  if (existing) {
    if (existing.result_locked === 1) {
      // El admin fijó el resultado a mano: solo actualizamos metadatos
      await tx.query(
        `UPDATE matches SET external_id = $1,
           group_name = COALESCE($2, group_name), matchday = COALESCE($3, matchday),
           kickoff_utc = $4,
           home_team_id = COALESCE($5, home_team_id),
           away_team_id = COALESCE($6, away_team_id),
           home_label = $7, away_label = $8
         WHERE id = $9`,
        [
          externalId,
          m.groupName,
          m.matchday,
          m.kickoffUtc,
          homeTeamId,
          awayTeamId,
          m.homeLabel,
          m.awayLabel,
          existing.id,
        ]
      )
    } else {
      // COALESCE en group_name/matchday: proveedores como ESPN no traen la
      // letra del grupo y no deben borrar la que sembró otro proveedor
      await tx.query(
        `UPDATE matches SET external_id = $1, stage = $2,
           group_name = COALESCE($3, group_name), matchday = COALESCE($4, matchday),
           kickoff_utc = $5,
           home_team_id = COALESCE($6, home_team_id),
           away_team_id = COALESCE($7, away_team_id),
           home_label = $8, away_label = $9,
           status = $10, home_goals = $11, away_goals = $12, minute = $13
         WHERE id = $14`,
        [
          externalId,
          m.stage,
          m.groupName,
          m.matchday,
          m.kickoffUtc,
          homeTeamId,
          awayTeamId,
          m.homeLabel,
          m.awayLabel,
          m.status,
          m.homeGoals,
          m.awayGoals,
          m.minute,
          existing.id,
        ]
      )
    }
    return
  }

  await tx.query(
    `INSERT INTO matches (external_id, stage, group_name, matchday, kickoff_utc,
       home_team_id, away_team_id, home_label, away_label, status, home_goals, away_goals, minute)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      externalId,
      m.stage,
      m.groupName,
      m.matchday,
      m.kickoffUtc,
      homeTeamId,
      awayTeamId,
      m.homeLabel,
      m.awayLabel,
      m.status,
      m.homeGoals,
      m.awayGoals,
      m.minute,
    ]
  )
}

/** Aplica los partidos de un proveedor a la base (exportada para tests) */
export async function applyProviderMatches(
  providerName: string,
  matches: ProviderMatch[]
): Promise<void> {
  const db = await getDb()
  await db.transaction(async (tx) => {
    for (const m of matches) {
      const homeId = m.homeTeam ? await upsertTeam(tx, providerName, m.homeTeam) : null
      const awayId = m.awayTeam ? await upsertTeam(tx, providerName, m.awayTeam) : null
      await upsertMatch(tx, providerName, m, homeId, awayId)
    }
  })
}

async function countMatches(): Promise<number> {
  const db = await getDb()
  const rows = await db.query<{ n: number }>('SELECT COUNT(*)::int AS n FROM matches')
  return rows[0]?.n ?? 0
}

export interface SyncResult {
  ok: boolean
  provider: string
  matches: number
  error?: string
}

export async function syncNow(): Promise<SyncResult> {
  const provider = getProvider()
  try {
    // ESPN solo cubre una ventana de días: el fixture completo se siembra y
    // se refresca desde worldcup26 (sin API key) cuando hace falta:
    //  - base vacía (primer arranque)
    //  - hay cruces de eliminatorias "por definir" a menos de 7 días
    //    (así los clasificados de cada fase aparecen solos)
    if (provider.name === 'espn') {
      const needsSeed = (await countMatches()) < FULL_FIXTURE_THRESHOLD
      const db = await getDb()
      const pendingKo = needsSeed
        ? []
        : await db.query(
            `SELECT 1 FROM matches
             WHERE home_team_id IS NULL AND kickoff_utc <= $1 AND status != 'FINISHED'
             LIMIT 1`,
            [new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString()]
          )
      if (needsSeed || pendingKo.length > 0) {
        const seeder = createWorldcup26Provider()
        const seeded = await seeder.fetchMatches()
        await applyProviderMatches(seeder.name, seeded)
      }
    }

    const matches = await provider.fetchMatches()
    await applyProviderMatches(provider.name, matches)

    // Catálogo de jugadores para los premios: se descarga una vez de los
    // rosters de ESPN (best effort: si falla, el admin puede reintentar)
    if ((await countPlayers()) < 500) {
      await syncSquads().catch(() => undefined)
    }

    await setSetting('last_sync_at', new Date().toISOString())
    await setSetting('last_sync_provider', provider.name)
    await setSetting('last_sync_count', String(matches.length))
    await setSetting('last_sync_error', '')
    return { ok: true, provider: provider.name, matches: matches.length }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await setSetting('last_sync_error', message)
    await setSetting('last_sync_error_at', new Date().toISOString())
    return { ok: false, provider: provider.name, matches: 0, error: message }
  }
}

/**
 * Sincroniza solo cuando hace falta:
 *  - nunca se ha sincronizado o la BD está vacía
 *  - hay partidos "activos" (entre 15 min antes del kickoff y 4 h después) y
 *    el último sync tiene más de 1 minuto
 *  - mantenimiento del fixture cada 6 h
 */
export async function maybeSync(): Promise<SyncResult | null> {
  const db = await getDb()
  const lastSyncAt = await getSetting('last_sync_at')
  const now = Date.now()
  const sinceLast = lastSyncAt ? now - Date.parse(lastSyncAt) : Number.POSITIVE_INFINITY

  if (sinceLast < SYNC_THROTTLE_MS) return null

  const matchCount = await countMatches()
  if (matchCount === 0 || !lastSyncAt) {
    return syncNow()
  }

  const activeRows = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM matches
     WHERE status != 'FINISHED' AND kickoff_utc <= $1 AND kickoff_utc >= $2`,
    [
      new Date(now + 15 * 60_000).toISOString(),
      new Date(now - 4 * 60 * 60_000).toISOString(),
    ]
  )

  if ((activeRows[0]?.n ?? 0) > 0 || sinceLast > IDLE_REFRESH_MS) {
    return syncNow()
  }
  return null
}

export interface SyncStatus {
  provider: string
  lastSyncAt: string | null
  lastSyncCount: string | null
  lastError: string | null
}

export async function getSyncStatus(): Promise<SyncStatus> {
  return {
    provider: resolveProviderName(),
    lastSyncAt: await getSetting('last_sync_at'),
    lastSyncCount: await getSetting('last_sync_count'),
    lastError: (await getSetting('last_sync_error')) || null,
  }
}
