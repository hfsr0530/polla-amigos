import 'server-only'
import { getDb } from '@/shared/db/client'
import type { MatchStatus, MatchWithTeams, Stage, Team } from '@/shared/types/domain'

interface MatchJoinRow {
  id: number
  external_id: string | null
  stage: Stage
  group_name: string | null
  matchday: number | null
  kickoff_utc: string
  home_team_id: number | null
  away_team_id: number | null
  home_label: string | null
  away_label: string | null
  status: MatchStatus
  home_goals: number | null
  away_goals: number | null
  minute: string | null
  result_locked: number
  ht_name: string | null
  ht_short: string | null
  ht_tla: string | null
  ht_crest: string | null
  ht_group: string | null
  ht_external: string | null
  at_name: string | null
  at_short: string | null
  at_tla: string | null
  at_crest: string | null
  at_group: string | null
  at_external: string | null
}

const MATCH_SELECT = `
SELECT m.id, m.external_id, m.stage, m.group_name, m.matchday, m.kickoff_utc,
       m.home_team_id, m.away_team_id, m.home_label, m.away_label,
       m.status, m.home_goals, m.away_goals, m.minute, m.result_locked,
       ht.name AS ht_name, ht.short_name AS ht_short, ht.tla AS ht_tla,
       ht.crest_url AS ht_crest, ht.group_name AS ht_group, ht.external_id AS ht_external,
       at.name AS at_name, at.short_name AS at_short, at.tla AS at_tla,
       at.crest_url AS at_crest, at.group_name AS at_group, at.external_id AS at_external
FROM matches m
LEFT JOIN teams ht ON ht.id = m.home_team_id
LEFT JOIN teams at ON at.id = m.away_team_id
`

function rowToMatch(row: MatchJoinRow): MatchWithTeams {
  const homeTeam: Team | null = row.home_team_id
    ? {
        id: row.home_team_id,
        externalId: row.ht_external,
        name: row.ht_name ?? '',
        shortName: row.ht_short,
        tla: row.ht_tla,
        crestUrl: row.ht_crest,
        groupName: row.ht_group,
      }
    : null
  const awayTeam: Team | null = row.away_team_id
    ? {
        id: row.away_team_id,
        externalId: row.at_external,
        name: row.at_name ?? '',
        shortName: row.at_short,
        tla: row.at_tla,
        crestUrl: row.at_crest,
        groupName: row.at_group,
      }
    : null

  return {
    id: row.id,
    externalId: row.external_id,
    stage: row.stage,
    groupName: row.group_name,
    matchday: row.matchday,
    kickoffUtc: row.kickoff_utc,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    homeLabel: row.home_label,
    awayLabel: row.away_label,
    status: row.status,
    homeGoals: row.home_goals,
    awayGoals: row.away_goals,
    minute: row.minute,
    resultLocked: row.result_locked === 1,
    homeTeam,
    awayTeam,
  }
}

export async function getAllMatches(): Promise<MatchWithTeams[]> {
  const db = await getDb()
  const rows = await db.query<MatchJoinRow>(
    `${MATCH_SELECT} ORDER BY m.kickoff_utc ASC, m.id ASC`
  )
  return rows.map(rowToMatch)
}

export async function getMatchById(id: number): Promise<MatchWithTeams | null> {
  const db = await getDb()
  const rows = await db.query<MatchJoinRow>(`${MATCH_SELECT} WHERE m.id = $1`, [id])
  return rows[0] ? rowToMatch(rows[0]) : null
}

export async function getAllTeams(): Promise<Team[]> {
  const db = await getDb()
  const rows = await db.query<{
    id: number
    external_id: string | null
    name: string
    short_name: string | null
    tla: string | null
    crest_url: string | null
    group_name: string | null
  }>(
    'SELECT id, external_id, name, short_name, tla, crest_url, group_name FROM teams ORDER BY name'
  )
  return rows.map((r) => ({
    id: r.id,
    externalId: r.external_id,
    name: r.name,
    shortName: r.short_name,
    tla: r.tla,
    crestUrl: r.crest_url,
    groupName: r.group_name,
  }))
}

/** Kickoff del primer partido: bloquea los pronósticos de premios */
export async function getTournamentStartUtc(): Promise<string | null> {
  const db = await getDb()
  const rows = await db.query<{ start: string | null }>(
    'SELECT MIN(kickoff_utc) AS start FROM matches'
  )
  return rows[0]?.start ?? null
}

export function isMatchStarted(match: { kickoffUtc: string }, now = new Date()): boolean {
  return now.getTime() >= Date.parse(match.kickoffUtc)
}

/** Resultado manual del admin: fija el marcador y bloquea el sync para ese partido */
export async function setManualResult(
  matchId: number,
  homeGoals: number,
  awayGoals: number,
  status: MatchStatus
): Promise<void> {
  const db = await getDb()
  await db.query(
    'UPDATE matches SET home_goals = $1, away_goals = $2, status = $3, result_locked = 1 WHERE id = $4',
    [homeGoals, awayGoals, status, matchId]
  )
}

/** Quita el candado manual: el próximo sync vuelve a mandar */
export async function unlockResult(matchId: number): Promise<void> {
  const db = await getDb()
  await db.query('UPDATE matches SET result_locked = 0 WHERE id = $1', [matchId])
}
