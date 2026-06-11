import type { Stage } from '@/shared/types/domain'
import { KNOCKOUT_STAGES } from '@/shared/types/domain'
import type { ScoringRules } from './rules'

export interface ScoreInput {
  home: number
  away: number
}

export interface MatchScoreBreakdown {
  /** Puntos por acertar resultado (1X2) */
  outcome: number
  /** Puntos por acertar el marcador exacto */
  exactScore: number
  /** Puntos por goles exactos por equipo */
  teamGoals: number
  total: number
}

const EMPTY_BREAKDOWN: MatchScoreBreakdown = { outcome: 0, exactScore: 0, teamGoals: 0, total: 0 }

function outcomeOf(score: ScoreInput): 'HOME' | 'DRAW' | 'AWAY' {
  if (score.home > score.away) return 'HOME'
  if (score.home < score.away) return 'AWAY'
  return 'DRAW'
}

/**
 * Puntúa el pronóstico de un partido contra el resultado real
 * (marcador al final del tiempo reglamentario).
 */
export function scoreMatch(
  prediction: ScoreInput,
  result: ScoreInput,
  stage: Stage,
  rules: ScoringRules
): MatchScoreBreakdown {
  const isKnockout = KNOCKOUT_STAGES.includes(stage)

  const outcomeHit = outcomeOf(prediction) === outcomeOf(result)
  const exactHit = prediction.home === result.home && prediction.away === result.away
  const teamGoalHits =
    (prediction.home === result.home ? 1 : 0) + (prediction.away === result.away ? 1 : 0)

  let outcome = outcomeHit ? (isKnockout ? rules.outcomeKnockout : rules.outcomeGroup) : 0
  const exactScore = exactHit ? (isKnockout ? rules.exactScoreKnockout : rules.exactScoreGroup) : 0
  let teamGoals = teamGoalHits * rules.exactTeamGoals

  if (exactHit && !rules.exactScoreIncludesOutcome) {
    outcome = 0
  }
  if (exactHit && !rules.teamGoalsStackWithExactScore) {
    teamGoals = 0
  }

  return { outcome, exactScore, teamGoals, total: outcome + exactScore + teamGoals }
}

/** Puntúa de forma segura cuando puede faltar pronóstico o resultado */
export function scoreMatchSafe(
  prediction: ScoreInput | null,
  result: ScoreInput | null,
  stage: Stage,
  rules: ScoringRules
): MatchScoreBreakdown {
  if (!prediction || !result) return EMPTY_BREAKDOWN
  return scoreMatch(prediction, result, stage, rules)
}
