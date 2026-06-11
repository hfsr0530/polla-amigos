import type { AwardKey } from '@/shared/types/domain'

export interface ScoringRules {
  /** Acertar el resultado (local/empate/visitante) en fase de grupos */
  outcomeGroup: number
  /** Acertar el marcador exacto en fase de grupos */
  exactScoreGroup: number
  /** Acertar el resultado en fases eliminatorias */
  outcomeKnockout: number
  /** Acertar el marcador exacto en fases eliminatorias */
  exactScoreKnockout: number
  /** Acertar los goles exactos de un equipo (se paga por cada equipo acertado) */
  exactTeamGoals: number
  /**
   * Si es true, el pleno (marcador exacto) suma TAMBIÉN los puntos de resultado.
   * Si es false, el marcador exacto reemplaza al resultado (no se suman).
   */
  exactScoreIncludesOutcome: boolean
  /**
   * Si es true, acertar el marcador exacto suma además los goles exactos de
   * ambos equipos. Si es false, los goles por equipo solo se pagan cuando
   * NO acertaste el marcador completo (premio de consolación).
   */
  teamGoalsStackWithExactScore: boolean
  /** Puntos por cada premio del torneo */
  awards: Record<AwardKey, number>
}

// Reglas oficiales de la polla (ver página /reglas).
// Cada acierto suma de forma independiente: un pleno en grupos paga
// resultado (1) + marcador (2) + goles de ambos equipos (2+2) = 7.
// Si prefieres que no se acumulen, cambia los dos booleanos de abajo.
export const DEFAULT_RULES: ScoringRules = {
  outcomeGroup: 1,
  exactScoreGroup: 2,
  outcomeKnockout: 2,
  exactScoreKnockout: 3,
  exactTeamGoals: 2,
  exactScoreIncludesOutcome: true,
  teamGoalsStackWithExactScore: true,
  awards: {
    CHAMPION: 10,
    RUNNER_UP: 7,
    THIRD: 4,
    FOURTH: 4,
    TOP_SCORER: 7,
    BEST_PLAYER: 7,
    BEST_GK: 5,
    BEST_YOUNG: 5,
  },
}
