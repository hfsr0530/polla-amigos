// Tipos de dominio compartidos entre features

export type Stage =
  | 'GROUP'
  | 'R32'
  | 'R16'
  | 'QF'
  | 'SF'
  | 'THIRD'
  | 'FINAL'

export const KNOCKOUT_STAGES: readonly Stage[] = ['R32', 'R16', 'QF', 'SF', 'THIRD', 'FINAL']

export const STAGE_LABELS: Record<Stage, string> = {
  GROUP: 'Fase de grupos',
  R32: 'Dieciseisavos',
  R16: 'Octavos',
  QF: 'Cuartos',
  SF: 'Semifinal',
  THIRD: 'Tercer puesto',
  FINAL: 'Final',
}

export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED'

/** Los pronósticos cierran este margen ANTES del kickoff correspondiente */
export const PREDICTION_LOCK_MINUTES = 10
export const PREDICTION_LOCK_MS = PREDICTION_LOCK_MINUTES * 60_000

export type AwardKey =
  | 'CHAMPION'
  | 'RUNNER_UP'
  | 'THIRD'
  | 'FOURTH'
  | 'TOP_SCORER'
  | 'BEST_PLAYER'
  | 'BEST_GK'
  | 'BEST_YOUNG'

export const TEAM_AWARDS: readonly AwardKey[] = ['CHAMPION', 'RUNNER_UP', 'THIRD', 'FOURTH']
export const PLAYER_AWARDS: readonly AwardKey[] = ['TOP_SCORER', 'BEST_PLAYER', 'BEST_GK', 'BEST_YOUNG']

export const AWARD_LABELS: Record<AwardKey, string> = {
  CHAMPION: 'Campeón',
  RUNNER_UP: 'Subcampeón',
  THIRD: 'Tercer puesto',
  FOURTH: 'Cuarto puesto',
  TOP_SCORER: 'Goleador',
  BEST_PLAYER: 'Mejor jugador',
  BEST_GK: 'Mejor arquero',
  BEST_YOUNG: 'Mejor jugador joven',
}

export interface Team {
  id: number
  externalId: string | null
  name: string
  shortName: string | null
  tla: string | null
  crestUrl: string | null
  groupName: string | null
}

export interface Match {
  id: number
  externalId: string | null
  stage: Stage
  groupName: string | null
  matchday: number | null
  kickoffUtc: string
  homeTeamId: number | null
  awayTeamId: number | null
  homeLabel: string | null
  awayLabel: string | null
  status: MatchStatus
  homeGoals: number | null
  awayGoals: number | null
  minute: string | null
  resultLocked: boolean
}

export interface MatchWithTeams extends Match {
  homeTeam: Team | null
  awayTeam: Team | null
}

export interface Prediction {
  entryId: number
  matchId: number
  homeGoals: number
  awayGoals: number
  updatedAt: string
}

export interface AwardPick {
  entryId: number
  award: AwardKey
  teamId: number | null
  playerId: number | null
  playerName: string | null
  correctOverride: number | null
  updatedAt: string
}

export interface AwardResult {
  award: AwardKey
  teamId: number | null
  playerId: number | null
  playerName: string | null
}

// ── Participación ────────────────────────────────────────────────────────────
// Una "polla" es un grupo independiente con su propio admin y su propia tabla.
// Una "entry" es quien compite dentro de una polla: una persona o una pareja.
// Cada login (user) pertenece a una entry; una pareja admite 2 logins.

export interface Polla {
  id: number
  name: string
  adminUserId: number | null
}

export type EntryKind = 'INDIVIDUAL' | 'PAIR'

export const ENTRY_CAPACITY: Record<EntryKind, number> = {
  INDIVIDUAL: 1,
  PAIR: 2,
}

export interface Entry {
  id: number
  pollaId: number
  name: string
  kind: EntryKind
  nameCustom: boolean
}

export interface EntryWithMembers extends Entry {
  members: string[]
}

export interface EntryMemberAccount {
  userId: number
  displayName: string
  isSuperadmin: boolean
}

export interface EntryWithMemberAccounts extends Entry {
  members: EntryMemberAccount[]
}

export interface Invite {
  code: string
  pollaId: number
  kind: EntryKind
  label: string | null
  entryId: number | null
  grantsAdmin: boolean
  revoked: boolean
  createdAt: string
}

export interface SessionUser {
  id: number
  username: string
  displayName: string
  /** Entrada activa: la polla que se está viendo en esta sesión */
  entryId: number
  pollaId: number
  /** Administra la polla ACTIVA: invitaciones y validación de picks */
  isPollaAdmin: boolean
  /** Ve todas las pollas y administra el torneo (sync, resultados, premios) */
  isSuperadmin: boolean
}

/** Una cuenta puede jugar en varias pollas: una entrada por polla */
export interface Membership {
  entryId: number
  entryName: string
  kind: EntryKind
  pollaId: number
  pollaName: string
  isActive: boolean
}
