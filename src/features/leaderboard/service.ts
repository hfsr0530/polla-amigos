import 'server-only'
import { listEntriesWithMembers } from '@/features/entries/service'
import { getAllMatches } from '@/features/matches/service'
import { getAllPredictions, getEntryPredictions } from '@/features/predictions/service'
import { getAllAwardPicks, getAwardResults, isPickCorrect } from '@/features/awards/service'
import { scoreMatchSafe, type MatchScoreBreakdown } from '@/features/scoring/engine'
import { DEFAULT_RULES } from '@/features/scoring/rules'
import type { AwardKey, EntryWithMembers, MatchWithTeams } from '@/shared/types/domain'

export interface LeaderboardRow {
  entry: EntryWithMembers
  /** Puntos firmes (partidos finalizados + premios definidos) */
  points: number
  /** Puntos extra si los partidos en vivo terminaran ahora mismo */
  livePoints: number
  matchPoints: number
  awardPoints: number
  exactScores: number
  predictionsCount: number
  position: number
}

export interface EntryMatchScore {
  match: MatchWithTeams
  prediction: { home: number; away: number } | null
  breakdown: MatchScoreBreakdown
  provisional: boolean
}

export interface EntryAwardScore {
  award: AwardKey
  pickLabel: string | null
  correct: boolean | null
  points: number
}

export async function computeLeaderboard(pollaId: number): Promise<LeaderboardRow[]> {
  const [entries, matches, predictions, awardPicks, awardResults] = await Promise.all([
    listEntriesWithMembers(pollaId),
    getAllMatches(),
    getAllPredictions(pollaId),
    getAllAwardPicks(pollaId),
    getAwardResults(),
  ])
  const rules = DEFAULT_RULES

  const predByEntry = new Map<number, Map<number, { home: number; away: number }>>()
  for (const p of predictions) {
    let m = predByEntry.get(p.entryId)
    if (!m) {
      m = new Map()
      predByEntry.set(p.entryId, m)
    }
    m.set(p.matchId, { home: p.homeGoals, away: p.awayGoals })
  }

  const picksByEntry = new Map<number, typeof awardPicks>()
  for (const pick of awardPicks) {
    const list = picksByEntry.get(pick.entryId) ?? []
    list.push(pick)
    picksByEntry.set(pick.entryId, list)
  }

  const rows: LeaderboardRow[] = entries.map((entry) => {
    const entryPreds = predByEntry.get(entry.id) ?? new Map()
    let matchPoints = 0
    let livePoints = 0
    let exactScores = 0

    for (const match of matches) {
      if (match.homeGoals === null || match.awayGoals === null) continue
      const pred = entryPreds.get(match.id) ?? null
      const result = { home: match.homeGoals, away: match.awayGoals }
      const breakdown = scoreMatchSafe(pred, result, match.stage, rules)

      if (match.status === 'FINISHED') {
        matchPoints += breakdown.total
        if (breakdown.exactScore > 0) exactScores += 1
      } else if (match.status === 'LIVE') {
        livePoints += breakdown.total
      }
    }

    let awardPoints = 0
    for (const pick of picksByEntry.get(entry.id) ?? []) {
      if (isPickCorrect(pick, awardResults.get(pick.award)) === true) {
        awardPoints += rules.awards[pick.award]
      }
    }

    return {
      entry,
      points: matchPoints + awardPoints,
      livePoints,
      matchPoints,
      awardPoints,
      exactScores,
      predictionsCount: entryPreds.size,
      position: 0,
    }
  })

  // Orden: puntos firmes, luego plenos, luego nombre
  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.exactScores - a.exactScores ||
      a.entry.name.localeCompare(b.entry.name)
  )
  let position = 0
  let lastPoints = Number.NaN
  let lastExact = Number.NaN
  rows.forEach((row, index) => {
    if (row.points !== lastPoints || row.exactScores !== lastExact) {
      position = index + 1
      lastPoints = row.points
      lastExact = row.exactScores
    }
    row.position = position
  })
  return rows
}

/** Desglose partido a partido para la página de un participante */
export async function computeEntryMatchScores(entryId: number): Promise<EntryMatchScore[]> {
  const [matches, entryPreds] = await Promise.all([
    getAllMatches(),
    getEntryPredictions(entryId),
  ])
  const rules = DEFAULT_RULES
  const preds = new Map<number, { home: number; away: number }>()
  for (const [matchId, p] of entryPreds) {
    preds.set(matchId, { home: p.homeGoals, away: p.awayGoals })
  }

  return matches.map((match) => {
    const prediction = preds.get(match.id) ?? null
    const hasResult = match.homeGoals !== null && match.awayGoals !== null
    const breakdown = scoreMatchSafe(
      prediction,
      hasResult ? { home: match.homeGoals as number, away: match.awayGoals as number } : null,
      match.stage,
      rules
    )
    return {
      match,
      prediction,
      breakdown,
      provisional: match.status === 'LIVE',
    }
  })
}
