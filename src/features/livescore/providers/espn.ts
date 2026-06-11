import 'server-only'
import type { MatchStatus, Stage } from '@/shared/types/domain'
import type { LivescoreProvider, ProviderMatch, ProviderTeam } from '../provider'

// Adapter para la API pública (no documentada) de ESPN — muy rápida para
// marcadores en vivo y sin API key. Consulta una ventana deslizante
// (ayer/hoy/mañana): el fixture completo se siembra con otro proveedor
// (ver el seed híbrido en sync.ts).

const BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard'

interface EspnTeam {
  id: string
  displayName: string
  shortDisplayName?: string
  abbreviation?: string
  logo?: string
}

interface EspnCompetitor {
  homeAway: 'home' | 'away'
  team: EspnTeam
  score?: string
}

interface EspnEvent {
  id: string
  date: string
  season?: { slug?: string }
  status?: {
    displayClock?: string
    type?: { state?: 'pre' | 'in' | 'post' }
  }
  competitions?: Array<{ competitors?: EspnCompetitor[] }>
}

function mapStage(slug: string | undefined): Stage {
  const s = (slug ?? '').toLowerCase()
  if (s.includes('group')) return 'GROUP'
  if (s.includes('32')) return 'R32'
  if (s.includes('16')) return 'R16'
  if (s.includes('quarter')) return 'QF'
  if (s.includes('semi')) return 'SF'
  if (s.includes('third') || s.includes('3rd')) return 'THIRD'
  if (s.includes('final')) return 'FINAL'
  return 'GROUP'
}

function mapStatus(state: string | undefined): MatchStatus {
  if (state === 'in') return 'LIVE'
  if (state === 'post') return 'FINISHED'
  return 'SCHEDULED'
}

function mapTeam(competitor: EspnCompetitor | undefined): ProviderTeam | null {
  const team = competitor?.team
  if (!team?.id || !team.displayName) return null
  return {
    externalId: team.id,
    name: team.displayName,
    shortName: team.shortDisplayName ?? null,
    tla: team.abbreviation ?? null,
    crestUrl: team.logo ?? null,
    // ESPN no expone la letra del grupo: el upsert no pisa la existente
    groupName: null,
  }
}

function parseScore(value: string | undefined, status: MatchStatus): number | null {
  if (status === 'SCHEDULED') return null
  const n = Number.parseInt(value ?? '', 10)
  return Number.isNaN(n) ? null : n
}

function mapEvent(event: EspnEvent): ProviderMatch | null {
  const competitors = event.competitions?.[0]?.competitors ?? []
  const home = competitors.find((c) => c.homeAway === 'home')
  const away = competitors.find((c) => c.homeAway === 'away')
  const kickoff = Date.parse(event.date)
  if (Number.isNaN(kickoff)) return null

  const status = mapStatus(event.status?.type?.state)
  return {
    externalId: event.id,
    stage: mapStage(event.season?.slug),
    groupName: null,
    matchday: null,
    kickoffUtc: new Date(kickoff).toISOString(),
    homeTeam: mapTeam(home),
    awayTeam: mapTeam(away),
    homeLabel: null,
    awayLabel: null,
    status,
    homeGoals: parseScore(home?.score, status),
    awayGoals: parseScore(away?.score, status),
    minute: status === 'LIVE' ? (event.status?.displayClock ?? null) : null,
  }
}

function yyyymmdd(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}

export function createEspnProvider(): LivescoreProvider {
  return {
    name: 'espn',
    async fetchMatches(): Promise<ProviderMatch[]> {
      const now = Date.now()
      const days = [-1, 0, 1].map((offset) => yyyymmdd(new Date(now + offset * 86_400_000)))

      const results = await Promise.all(
        days.map(async (day) => {
          const res = await fetch(`${BASE_URL}?dates=${day}`, { cache: 'no-store' })
          if (!res.ok) {
            throw new Error(`ESPN respondió ${res.status} para ${day}`)
          }
          const data = (await res.json()) as { events?: EspnEvent[] }
          return data.events ?? []
        })
      )

      const seen = new Set<string>()
      const matches: ProviderMatch[] = []
      for (const event of results.flat()) {
        if (seen.has(event.id)) continue
        seen.add(event.id)
        const mapped = mapEvent(event)
        if (mapped) matches.push(mapped)
      }
      return matches
    },
  }
}
