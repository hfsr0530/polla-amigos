import 'server-only'
import type { MatchStatus, Stage } from '@/shared/types/domain'
import type { LivescoreProvider, ProviderMatch, ProviderTeam } from '../provider'

// Adapter para https://www.football-data.org (API v4, competición "WC").
// El tier gratuito requiere API key y entrega marcadores con un pequeño delay.

const API_URL = 'https://api.football-data.org/v4/competitions/WC/matches'

interface FdTeam {
  id: number | null
  name: string | null
  shortName: string | null
  tla: string | null
  crest: string | null
}

interface FdScorePart {
  home: number | null
  away: number | null
}

interface FdMatch {
  id: number
  utcDate: string
  status: string
  matchday: number | null
  stage: string
  group: string | null
  homeTeam: FdTeam | null
  awayTeam: FdTeam | null
  score: {
    duration: string
    fullTime: FdScorePart
    regularTime?: FdScorePart
  }
}

const STAGE_MAP: Record<string, Stage> = {
  GROUP_STAGE: 'GROUP',
  LAST_32: 'R32',
  ROUND_OF_32: 'R32',
  PLAYOFF_ROUND: 'R32',
  LAST_16: 'R16',
  ROUND_OF_16: 'R16',
  QUARTER_FINALS: 'QF',
  SEMI_FINALS: 'SF',
  THIRD_PLACE: 'THIRD',
  THIRD_PLACE_PLAYOFF: 'THIRD',
  FINAL: 'FINAL',
}

function mapStatus(status: string): MatchStatus {
  switch (status) {
    case 'IN_PLAY':
    case 'PAUSED':
    case 'SUSPENDED':
      return 'LIVE'
    case 'FINISHED':
    case 'AWARDED':
      return 'FINISHED'
    default:
      return 'SCHEDULED'
  }
}

function mapTeam(team: FdTeam | null, group: string | null): ProviderTeam | null {
  if (!team || team.id === null || !team.name) return null
  return {
    externalId: String(team.id),
    name: team.name,
    shortName: team.shortName,
    tla: team.tla,
    crestUrl: team.crest,
    groupName: group,
  }
}

function mapMatch(m: FdMatch): ProviderMatch {
  const stage = STAGE_MAP[m.stage] ?? (m.group ? 'GROUP' : 'R32')
  const status = mapStatus(m.status)
  // "Group A" → "A"
  const group = m.group ? m.group.replace(/^Group\s+/i, '') : null

  // Puntuamos sobre el tiempo reglamentario: si hubo prórroga el proveedor
  // expone regularTime; si no, fullTime ya es el marcador de los 90'
  const score = m.score.regularTime ?? m.score.fullTime
  const hasScore = status !== 'SCHEDULED'

  return {
    externalId: String(m.id),
    stage,
    groupName: group,
    matchday: m.matchday,
    kickoffUtc: m.utcDate,
    homeTeam: mapTeam(m.homeTeam, stage === 'GROUP' ? group : null),
    awayTeam: mapTeam(m.awayTeam, stage === 'GROUP' ? group : null),
    homeLabel: null,
    awayLabel: null,
    status,
    homeGoals: hasScore ? (score?.home ?? null) : null,
    awayGoals: hasScore ? (score?.away ?? null) : null,
    minute: null,
  }
}

export function createFootballDataProvider(): LivescoreProvider {
  return {
    name: 'football-data',
    async fetchMatches(): Promise<ProviderMatch[]> {
      const apiKey = process.env.FOOTBALL_DATA_API_KEY
      if (!apiKey) {
        throw new Error('Falta FOOTBALL_DATA_API_KEY en las variables de entorno')
      }
      const res = await fetch(API_URL, {
        headers: { 'X-Auth-Token': apiKey },
        // El sync controla su propia frecuencia: no usar el caché de Next
        cache: 'no-store',
      })
      if (!res.ok) {
        throw new Error(`football-data.org respondió ${res.status}`)
      }
      const data = (await res.json()) as { matches?: FdMatch[] }
      return (data.matches ?? []).map(mapMatch)
    },
  }
}
