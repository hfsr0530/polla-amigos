import 'server-only'
import { getDb } from '@/shared/db/client'
import { normalizeName } from '@/shared/lib/utils'

// Catálogo de jugadores de las 48 selecciones, sincronizado desde los rosters
// públicos de ESPN. Alimenta los selectores de premios (goleador, etc.).

const ESPN_TEAMS_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams'
const ESPN_ROSTER_URL = (teamId: string) =>
  `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams/${teamId}/roster`
const FETCH_CONCURRENCY = 8

export interface PlayerOption {
  id: number
  name: string
  position: string | null
  jersey: string | null
  teamId: number
  teamName: string
  teamTla: string | null
}

export async function listPlayers(): Promise<PlayerOption[]> {
  const db = await getDb()
  const rows = await db.query<{
    id: number
    name: string
    position: string | null
    jersey: string | null
    team_id: number
    team_name: string
    team_tla: string | null
  }>(
    `SELECT p.id, p.name, p.position, p.jersey, p.team_id,
            tm.name AS team_name, tm.tla AS team_tla
     FROM players p JOIN teams tm ON tm.id = p.team_id
     ORDER BY p.name`
  )
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    position: r.position,
    jersey: r.jersey,
    teamId: r.team_id,
    teamName: r.team_name,
    teamTla: r.team_tla,
  }))
}

export async function countPlayers(): Promise<number> {
  const db = await getDb()
  const rows = await db.query<{ n: number }>('SELECT COUNT(*)::int AS n FROM players')
  return rows[0]?.n ?? 0
}

export async function getPlayerById(id: number): Promise<PlayerOption | null> {
  const players = await listPlayers()
  return players.find((p) => p.id === id) ?? null
}

// Etiqueta única para el buscador: "Lionel Messi · ARG"
export function playerLabel(player: { name: string; teamTla: string | null; teamName: string }): string {
  return `${player.name} · ${player.teamTla ?? player.teamName}`
}

interface EspnTeamEntry {
  team: {
    id: string
    displayName: string
    abbreviation?: string
    logos?: Array<{ href?: string }>
  }
}

interface EspnAthlete {
  id: string
  displayName: string
  position?: { name?: string }
  jersey?: string
}

interface EspnTeamSummary {
  id: string
  name: string
  tla: string | null
  logo: string | null
}

async function fetchEspnTeams(): Promise<EspnTeamSummary[]> {
  const res = await fetch(ESPN_TEAMS_URL, { cache: 'no-store' })
  if (!res.ok) throw new Error(`ESPN teams respondió ${res.status}`)
  const data = (await res.json()) as {
    sports?: Array<{ leagues?: Array<{ teams?: EspnTeamEntry[] }> }>
  }
  const entries = data.sports?.[0]?.leagues?.[0]?.teams ?? []
  return entries.map((e) => ({
    id: e.team.id,
    name: e.team.displayName,
    tla: e.team.abbreviation ?? null,
    logo: e.team.logos?.[0]?.href ?? null,
  }))
}

async function fetchEspnRoster(teamId: string): Promise<EspnAthlete[]> {
  const res = await fetch(ESPN_ROSTER_URL(teamId), { cache: 'no-store' })
  if (!res.ok) return []
  const data = (await res.json()) as { athletes?: EspnAthlete[] }
  return data.athletes ?? []
}

export interface SquadSyncResult {
  ok: boolean
  players: number
  teamsMatched: number
  teamsSkipped: number
  error?: string
}

/**
 * Descarga los rosters de ESPN y los cruza con nuestros equipos por nombre.
 * Idempotente: re-ejecutar actualiza nombres/posiciones sin duplicar.
 */
export async function syncSquads(): Promise<SquadSyncResult> {
  try {
    const db = await getDb()
    const [espnTeams, localTeams] = await Promise.all([
      fetchEspnTeams(),
      db.query<{ id: number; name: string }>('SELECT id, name FROM teams'),
    ])

    const localByKey = new Map(localTeams.map((tm) => [normalizeName(tm.name), tm.id]))
    let players = 0
    let teamsMatched = 0
    let teamsSkipped = 0

    // En tandas para no disparar 48 requests simultáneos contra ESPN
    for (let i = 0; i < espnTeams.length; i += FETCH_CONCURRENCY) {
      const batch = espnTeams.slice(i, i + FETCH_CONCURRENCY)
      const rosters = await Promise.all(
        batch.map(async (espnTeam) => ({
          espnTeam,
          athletes: await fetchEspnRoster(espnTeam.id),
        }))
      )

      for (const { espnTeam, athletes } of rosters) {
        const localTeamId = localByKey.get(normalizeName(espnTeam.name))
        if (!localTeamId) {
          teamsSkipped++
          continue
        }
        // De paso completamos bandera y sigla del equipo (ESPN las trae todas)
        await db.query(
          `UPDATE teams SET crest_url = COALESCE(crest_url, $1), tla = COALESCE(tla, $2)
           WHERE id = $3`,
          [espnTeam.logo, espnTeam.tla, localTeamId]
        )
        if (athletes.length === 0) {
          teamsSkipped++
          continue
        }
        teamsMatched++
        for (const athlete of athletes) {
          if (!athlete.id || !athlete.displayName) continue
          await db.query(
            `INSERT INTO players (team_id, external_id, name, position, jersey)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (external_id) DO UPDATE SET
               team_id = EXCLUDED.team_id, name = EXCLUDED.name,
               position = EXCLUDED.position, jersey = EXCLUDED.jersey`,
            [
              localTeamId,
              `espn:${athlete.id}`,
              athlete.displayName,
              athlete.position?.name ?? null,
              athlete.jersey ?? null,
            ]
          )
          players++
        }
      }
    }

    return { ok: true, players, teamsMatched, teamsSkipped }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, players: 0, teamsMatched: 0, teamsSkipped: 0, error: message }
  }
}
