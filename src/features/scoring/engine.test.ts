import { describe, expect, it } from 'vitest'
import { scoreMatch, scoreMatchSafe } from './engine'
import { DEFAULT_RULES } from './rules'

describe('scoreMatch — fase de grupos', () => {
  it('pleno: resultado + marcador + goles de ambos equipos (1+2+2+2 = 7)', () => {
    const b = scoreMatch({ home: 2, away: 1 }, { home: 2, away: 1 }, 'GROUP', DEFAULT_RULES)
    expect(b).toEqual({ outcome: 1, exactScore: 2, teamGoals: 4, total: 7 })
  })

  it('resultado correcto + goles exactos de un equipo (1+2 = 3)', () => {
    // pronóstico 2-1, real 2-0: gana local ✓, goles del local ✓
    const b = scoreMatch({ home: 2, away: 1 }, { home: 2, away: 0 }, 'GROUP', DEFAULT_RULES)
    expect(b).toEqual({ outcome: 1, exactScore: 0, teamGoals: 2, total: 3 })
  })

  it('solo resultado correcto, sin goles exactos (1)', () => {
    const b = scoreMatch({ home: 2, away: 1 }, { home: 3, away: 0 }, 'GROUP', DEFAULT_RULES)
    expect(b).toEqual({ outcome: 1, exactScore: 0, teamGoals: 0, total: 1 })
  })

  it('resultado fallado pero goles exactos de un equipo (2)', () => {
    // pronóstico 2-1 (gana local), real 0-1 (gana visitante): goles del visitante ✓
    const b = scoreMatch({ home: 2, away: 1 }, { home: 0, away: 1 }, 'GROUP', DEFAULT_RULES)
    expect(b).toEqual({ outcome: 0, exactScore: 0, teamGoals: 2, total: 2 })
  })

  it('empate pronosticado y empate real con otro marcador: resultado + a veces goles', () => {
    // 1-1 vs 2-2: resultado ✓, ningún gol exacto
    const b = scoreMatch({ home: 1, away: 1 }, { home: 2, away: 2 }, 'GROUP', DEFAULT_RULES)
    expect(b).toEqual({ outcome: 1, exactScore: 0, teamGoals: 0, total: 1 })
  })

  it('todo fallado (0)', () => {
    const b = scoreMatch({ home: 1, away: 0 }, { home: 0, away: 2 }, 'GROUP', DEFAULT_RULES)
    expect(b.total).toBe(0)
  })
})

describe('scoreMatch — fases eliminatorias', () => {
  it('pleno en eliminatorias: 2+3+4 = 9', () => {
    const b = scoreMatch({ home: 1, away: 0 }, { home: 1, away: 0 }, 'QF', DEFAULT_RULES)
    expect(b).toEqual({ outcome: 2, exactScore: 3, teamGoals: 4, total: 9 })
  })

  it('resultado en eliminatorias vale 2', () => {
    const b = scoreMatch({ home: 2, away: 0 }, { home: 1, away: 0 }, 'FINAL', DEFAULT_RULES)
    expect(b).toEqual({ outcome: 2, exactScore: 0, teamGoals: 2, total: 4 })
  })

  it('el empate a los 90 minutos cuenta como resultado en eliminatorias', () => {
    const b = scoreMatch({ home: 1, away: 1 }, { home: 1, away: 1 }, 'R16', DEFAULT_RULES)
    expect(b).toEqual({ outcome: 2, exactScore: 3, teamGoals: 4, total: 9 })
  })
})

describe('flags de configuración', () => {
  it('exactScoreIncludesOutcome=false: el pleno no suma el resultado', () => {
    const rules = { ...DEFAULT_RULES, exactScoreIncludesOutcome: false }
    const b = scoreMatch({ home: 2, away: 1 }, { home: 2, away: 1 }, 'GROUP', rules)
    expect(b).toEqual({ outcome: 0, exactScore: 2, teamGoals: 4, total: 6 })
  })

  it('teamGoalsStackWithExactScore=false: el pleno no suma goles por equipo', () => {
    const rules = { ...DEFAULT_RULES, teamGoalsStackWithExactScore: false }
    const b = scoreMatch({ home: 2, away: 1 }, { home: 2, away: 1 }, 'GROUP', rules)
    expect(b).toEqual({ outcome: 1, exactScore: 2, teamGoals: 0, total: 3 })
    // y en acierto parcial los goles por equipo sí pagan
    const partial = scoreMatch({ home: 2, away: 1 }, { home: 2, away: 0 }, 'GROUP', rules)
    expect(partial.teamGoals).toBe(2)
  })
})

describe('scoreMatchSafe', () => {
  it('devuelve cero sin pronóstico o sin resultado', () => {
    expect(scoreMatchSafe(null, { home: 1, away: 0 }, 'GROUP', DEFAULT_RULES).total).toBe(0)
    expect(scoreMatchSafe({ home: 1, away: 0 }, null, 'GROUP', DEFAULT_RULES).total).toBe(0)
  })
})
