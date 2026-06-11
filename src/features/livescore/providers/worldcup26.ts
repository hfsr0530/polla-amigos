import 'server-only'
import type { MatchStatus, Stage } from '@/shared/types/domain'
import type { LivescoreProvider, ProviderMatch, ProviderTeam } from '../provider'

// Adapter para https://worldcup26.ir — API comunitaria gratuita sin API key.
// Útil para arrancar sin registrarse en ningún lado; para horarios y
// marcadores oficiales se recomienda football-data.org.

const API_URL = 'https://worldcup26.ir/get/games'

interface Wc26Game {
  id: string
  home_team_id: string
  away_team_id: string
  home_score: string
  away_score: string
  group: string | null
  matchday: string | null
  local_date: string
  finished: string
  time_elapsed: string
  type: string
  home_team_name_en: string | null
  away_team_name_en: string | null
  home_team_label?: string | null
  away_team_label?: string | null
}

const STAGE_MAP: Record<string, Stage> = {
  group: 'GROUP',
  r32: 'R32',
  r16: 'R16',
  qf: 'QF',
  sf: 'SF',
  third: 'THIRD',
  final: 'FINAL',
}

// La API expone "MM/DD/YYYY HH:mm" sin zona horaria. La mayoría de sedes del
// Mundial 2026 están en horario del Este (UTC-4 en junio/julio), así que
// asumimos ET. Si necesitas horarios exactos por sede usa football-data.org.
function toUtcIso(localDate: string): string {
  const m = localDate.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/)
  if (!m) return new Date().toISOString()
  const [, month, day, year, hour, minute] = m
  const utcMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) + 4, // ET (UTC-4) → UTC
    Number(minute)
  )
  return new Date(utcMs).toISOString()
}

function parseScore(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const n = Number.parseInt(value, 10)
  return Number.isNaN(n) ? null : n
}

function mapStatus(game: Wc26Game): MatchStatus {
  if (game.finished?.toUpperCase() === 'TRUE') return 'FINISHED'
  if (game.time_elapsed && game.time_elapsed !== 'notstarted') return 'LIVE'
  return 'SCHEDULED'
}

function mapTeam(
  id: string | null,
  name: string | null | undefined,
  group: string | null
): ProviderTeam | null {
  if (!id || !name || name === 'null') return null
  return {
    externalId: id,
    name,
    shortName: null,
    tla: null,
    crestUrl: null,
    groupName: group,
  }
}

function mapMatch(g: Wc26Game): ProviderMatch {
  const stage = STAGE_MAP[g.type?.toLowerCase() ?? ''] ?? 'GROUP'
  const status = mapStatus(g)
  const group = g.group && g.group !== 'null' ? g.group : null

  return {
    externalId: g.id,
    stage,
    groupName: group,
    matchday: g.matchday ? Number.parseInt(g.matchday, 10) || null : null,
    kickoffUtc: toUtcIso(g.local_date),
    homeTeam: mapTeam(g.home_team_id, g.home_team_name_en, stage === 'GROUP' ? group : null),
    awayTeam: mapTeam(g.away_team_id, g.away_team_name_en, stage === 'GROUP' ? group : null),
    homeLabel: g.home_team_label ?? null,
    awayLabel: g.away_team_label ?? null,
    status,
    homeGoals: status === 'SCHEDULED' ? null : parseScore(g.home_score),
    awayGoals: status === 'SCHEDULED' ? null : parseScore(g.away_score),
    minute: status === 'LIVE' ? g.time_elapsed : null,
  }
}

export function createWorldcup26Provider(): LivescoreProvider {
  return {
    name: 'worldcup26',
    async fetchMatches(): Promise<ProviderMatch[]> {
      const res = await fetch(API_URL, { cache: 'no-store' })
      if (!res.ok) {
        throw new Error(`worldcup26.ir respondió ${res.status}`)
      }
      const body = (await res.json()) as unknown
      // La API puede envolver la lista en {data} o {games}
      const games = Array.isArray(body)
        ? body
        : ((body as { data?: unknown[]; games?: unknown[] }).data ??
          (body as { data?: unknown[]; games?: unknown[] }).games ??
          [])
      return (games as Wc26Game[]).map(mapMatch)
    },
  }
}
