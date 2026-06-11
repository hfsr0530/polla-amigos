import 'server-only'
import { getDb, nowIso } from '@/shared/db/client'
import { PREDICTION_LOCK_MS, type Prediction } from '@/shared/types/domain'

interface PredictionRow {
  entry_id: number
  match_id: number
  home_goals: number
  away_goals: number
  updated_at: string
}

function rowToPrediction(r: PredictionRow): Prediction {
  return {
    entryId: r.entry_id,
    matchId: r.match_id,
    homeGoals: r.home_goals,
    awayGoals: r.away_goals,
    updatedAt: r.updated_at,
  }
}

/** Pronósticos de un participante (individual o pareja), indexados por partido */
export async function getEntryPredictions(entryId: number): Promise<Map<number, Prediction>> {
  const db = await getDb()
  const rows = await db.query<PredictionRow>(
    'SELECT * FROM predictions WHERE entry_id = $1',
    [entryId]
  )
  return new Map(rows.map((r) => [r.match_id, rowToPrediction(r)]))
}

/** Todos los pronósticos de una polla (para tabla y vista de pares) */
export async function getAllPredictions(pollaId: number): Promise<Prediction[]> {
  const db = await getDb()
  const rows = await db.query<PredictionRow>(
    `SELECT p.* FROM predictions p
     JOIN entries e ON e.id = p.entry_id WHERE e.polla_id = $1`,
    [pollaId]
  )
  return rows.map(rowToPrediction)
}

export interface SavePredictionResult {
  ok: boolean
  error?: string
}

export async function savePrediction(
  entryId: number,
  matchId: number,
  homeGoals: number,
  awayGoals: number
): Promise<SavePredictionResult> {
  if (
    !Number.isInteger(homeGoals) ||
    !Number.isInteger(awayGoals) ||
    homeGoals < 0 ||
    homeGoals > 99 ||
    awayGoals < 0 ||
    awayGoals > 99
  ) {
    return { ok: false, error: 'Marcador inválido' }
  }

  const db = await getDb()
  const matches = await db.query<{ kickoff_utc: string; status: string }>(
    'SELECT kickoff_utc, status FROM matches WHERE id = $1',
    [matchId]
  )
  const match = matches[0]

  if (!match) {
    return { ok: false, error: 'El partido no existe' }
  }
  // El candado cae 10 minutos antes del pitazo inicial
  if (
    Date.now() >= Date.parse(match.kickoff_utc) - PREDICTION_LOCK_MS ||
    match.status !== 'SCHEDULED'
  ) {
    return { ok: false, error: 'Los pronósticos cierran 10 minutos antes del partido' }
  }

  // En parejas, cualquiera de los dos puede actualizar el pronóstico compartido
  await db.query(
    `INSERT INTO predictions (entry_id, match_id, home_goals, away_goals, updated_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (entry_id, match_id)
     DO UPDATE SET home_goals = EXCLUDED.home_goals, away_goals = EXCLUDED.away_goals,
                   updated_at = EXCLUDED.updated_at`,
    [entryId, matchId, homeGoals, awayGoals, nowIso()]
  )

  return { ok: true }
}
