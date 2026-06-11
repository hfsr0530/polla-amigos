import 'server-only'
import type { MatchStatus, Stage } from '@/shared/types/domain'

export interface ProviderTeam {
  externalId: string
  name: string
  shortName: string | null
  tla: string | null
  crestUrl: string | null
  groupName: string | null
}

export interface ProviderMatch {
  externalId: string
  stage: Stage
  groupName: string | null
  matchday: number | null
  kickoffUtc: string
  homeTeam: ProviderTeam | null
  awayTeam: ProviderTeam | null
  homeLabel: string | null
  awayLabel: string | null
  status: MatchStatus
  /** Goles al final del tiempo reglamentario (o marcador actual si está en vivo) */
  homeGoals: number | null
  awayGoals: number | null
  minute: string | null
}

export interface LivescoreProvider {
  /** Identificador estable: prefija los external_id en la base de datos */
  name: string
  fetchMatches(): Promise<ProviderMatch[]>
}

export type ProviderName = 'football-data' | 'worldcup26' | 'espn'

export function resolveProviderName(): ProviderName {
  const configured = process.env.LIVESCORE_PROVIDER
  if (configured === 'football-data' || configured === 'worldcup26' || configured === 'espn') {
    return configured
  }
  // Sin configuración explícita: football-data si hay API key, si no ESPN
  // (live scores rápidos sin key; el fixture se siembra solo)
  return process.env.FOOTBALL_DATA_API_KEY ? 'football-data' : 'espn'
}
