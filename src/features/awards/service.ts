import 'server-only'
import { getDb, nowIso } from '@/shared/db/client'
import { normalizeName } from '@/shared/lib/utils'
import { getTournamentStartUtc } from '@/features/matches/service'
import { isAwardsOpen } from '@/features/pollas/service'
import type { AwardKey, AwardPick, AwardResult } from '@/shared/types/domain'
import { PLAYER_AWARDS, PREDICTION_LOCK_MS, TEAM_AWARDS } from '@/shared/types/domain'

interface PickRow {
  entry_id: number
  award: AwardKey
  team_id: number | null
  player_id: number | null
  player_name: string | null
  correct_override: number | null
  updated_at: string
}

function rowToPick(r: PickRow): AwardPick {
  return {
    entryId: r.entry_id,
    award: r.award,
    teamId: r.team_id,
    playerId: r.player_id,
    playerName: r.player_name,
    correctOverride: r.correct_override,
    updatedAt: r.updated_at,
  }
}

/**
 * Los premios cierran 10 minutos antes del primer partido del Mundial, salvo
 * que el admin de la polla haya habilitado la edición manualmente (override).
 */
export async function areAwardsLocked(pollaId: number, now = new Date()): Promise<boolean> {
  if (await isAwardsOpen(pollaId)) return false
  const start = await getTournamentStartUtc()
  if (!start) return false
  return now.getTime() >= Date.parse(start) - PREDICTION_LOCK_MS
}

export async function getEntryAwardPicks(entryId: number): Promise<Map<AwardKey, AwardPick>> {
  const db = await getDb()
  const rows = await db.query<PickRow>('SELECT * FROM award_picks WHERE entry_id = $1', [
    entryId,
  ])
  return new Map(rows.map((r) => [r.award, rowToPick(r)]))
}

/** Picks de premios de una polla */
export async function getAllAwardPicks(pollaId: number): Promise<AwardPick[]> {
  const db = await getDb()
  const rows = await db.query<PickRow>(
    `SELECT a.* FROM award_picks a
     JOIN entries e ON e.id = a.entry_id WHERE e.polla_id = $1`,
    [pollaId]
  )
  return rows.map(rowToPick)
}

export interface SavePickResult {
  ok: boolean
  error?: string
}

export async function saveAwardPick(
  entryId: number,
  award: AwardKey,
  value: { teamId?: number; playerId?: number }
): Promise<SavePickResult> {
  const db = await getDb()
  const entryRows = await db.query<{ polla_id: number }>(
    'SELECT polla_id FROM entries WHERE id = $1',
    [entryId]
  )
  const pollaId = entryRows[0]?.polla_id
  if (!pollaId) return { ok: false, error: 'La entrada no existe' }
  if (await areAwardsLocked(pollaId)) {
    return { ok: false, error: 'El torneo ya comenzó: los premios están cerrados' }
  }
  if (TEAM_AWARDS.includes(award)) {
    const teamId = value.teamId
    if (!teamId || (await db.query('SELECT 1 FROM teams WHERE id = $1', [teamId])).length === 0) {
      return { ok: false, error: 'Equipo inválido' }
    }
    await db.query(
      `INSERT INTO award_picks (entry_id, award, team_id, player_id, player_name, updated_at)
       VALUES ($1, $2, $3, NULL, NULL, $4)
       ON CONFLICT (entry_id, award)
       DO UPDATE SET team_id = EXCLUDED.team_id, player_id = NULL, player_name = NULL,
                     updated_at = EXCLUDED.updated_at`,
      [entryId, award, teamId, nowIso()]
    )
    return { ok: true }
  }

  if (PLAYER_AWARDS.includes(award)) {
    // El jugador se elige del catálogo: nada de texto libre
    const playerId = value.playerId
    const players = playerId
      ? await db.query<{ id: number; name: string }>(
          'SELECT id, name FROM players WHERE id = $1',
          [playerId]
        )
      : []
    const player = players[0]
    if (!player) {
      return { ok: false, error: 'Elige un jugador de la lista' }
    }
    await db.query(
      `INSERT INTO award_picks (entry_id, award, team_id, player_id, player_name, updated_at)
       VALUES ($1, $2, NULL, $3, $4, $5)
       ON CONFLICT (entry_id, award)
       DO UPDATE SET player_id = EXCLUDED.player_id, player_name = EXCLUDED.player_name,
                     team_id = NULL, correct_override = NULL, updated_at = EXCLUDED.updated_at`,
      [entryId, award, player.id, player.name, nowIso()]
    )
    return { ok: true }
  }

  return { ok: false, error: 'Premio desconocido' }
}

export async function getAwardResults(): Promise<Map<AwardKey, AwardResult>> {
  const db = await getDb()
  const rows = await db.query<{
    award: AwardKey
    team_id: number | null
    player_id: number | null
    player_name: string | null
  }>('SELECT * FROM award_results')
  return new Map(
    rows.map((r) => [
      r.award,
      { award: r.award, teamId: r.team_id, playerId: r.player_id, playerName: r.player_name },
    ])
  )
}

/** El admin define el ganador oficial de un premio (o lo limpia con valores nulos) */
export async function setAwardResult(
  award: AwardKey,
  value: { teamId?: number | null; playerId?: number | null }
): Promise<SavePickResult> {
  const db = await getDb()
  const teamId = TEAM_AWARDS.includes(award) ? (value.teamId ?? null) : null
  let playerId: number | null = null
  let playerName: string | null = null

  if (PLAYER_AWARDS.includes(award) && value.playerId) {
    const players = await db.query<{ id: number; name: string }>(
      'SELECT id, name FROM players WHERE id = $1',
      [value.playerId]
    )
    if (!players[0]) {
      return { ok: false, error: 'Elige un jugador de la lista' }
    }
    playerId = players[0].id
    playerName = players[0].name
  }

  if (teamId === null && playerId === null) {
    await db.query('DELETE FROM award_results WHERE award = $1', [award])
    return { ok: true }
  }
  await db.query(
    `INSERT INTO award_results (award, team_id, player_id, player_name) VALUES ($1, $2, $3, $4)
     ON CONFLICT (award) DO UPDATE SET team_id = EXCLUDED.team_id,
                                       player_id = EXCLUDED.player_id,
                                       player_name = EXCLUDED.player_name`,
    [award, teamId, playerId, playerName]
  )
  return { ok: true }
}

/** El admin corrige a mano si un pick de jugador es acierto (matching con typos) */
export async function setPickCorrectOverride(
  entryId: number,
  award: AwardKey,
  correct: boolean | null
): Promise<void> {
  const db = await getDb()
  await db.query(
    'UPDATE award_picks SET correct_override = $1 WHERE entry_id = $2 AND award = $3',
    [correct === null ? null : correct ? 1 : 0, entryId, award]
  )
}

/**
 * Evalúa si un pick acierta el resultado oficial.
 * - Premios de equipo: comparación directa de IDs.
 * - Premios de jugador: override del admin si existe; si no, ID del catálogo
 *   (con fallback a nombre normalizado para picks antiguos sin ID).
 * Devuelve null si el resultado oficial aún no está definido.
 */
export function isPickCorrect(pick: AwardPick, result: AwardResult | undefined): boolean | null {
  if (!result) return null
  if (TEAM_AWARDS.includes(pick.award)) {
    if (result.teamId === null) return null
    return pick.teamId === result.teamId
  }
  if (pick.correctOverride !== null) return pick.correctOverride === 1
  if (result.playerId === null && !result.playerName) return null
  if (pick.playerId !== null && result.playerId !== null) {
    return pick.playerId === result.playerId
  }
  if (!result.playerName || !pick.playerName) return false
  return normalizeName(pick.playerName) === normalizeName(result.playerName)
}
