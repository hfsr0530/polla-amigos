import 'server-only'
import { randomBytes } from 'node:crypto'
import { getDb, nowIso } from '@/shared/db/client'
import { ENTRY_CAPACITY, type EntryKind, type Invite } from '@/shared/types/domain'

// Sin caracteres ambiguos (0/O, 1/I/L) para dictarlo por teléfono sin dramas
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8

function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH)
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  }
  return code
}

interface InviteRow {
  code: string
  polla_id: number
  kind: EntryKind
  label: string | null
  entry_id: number | null
  grants_admin: number
  revoked: number
  created_at: string
}

function rowToInvite(r: InviteRow): Invite {
  return {
    code: r.code,
    pollaId: r.polla_id,
    kind: r.kind,
    label: r.label,
    entryId: r.entry_id,
    grantsAdmin: r.grants_admin === 1,
    revoked: r.revoked === 1,
    createdAt: r.created_at,
  }
}

export async function getInvite(code: string): Promise<Invite | null> {
  const db = await getDb()
  const rows = await db.query<InviteRow>('SELECT * FROM invites WHERE code = $1', [
    code.trim().toUpperCase(),
  ])
  return rows[0] ? rowToInvite(rows[0]) : null
}

export interface CreateInviteOptions {
  label?: string | null
  /** Invitación para unirse a una entrada existente (p. ej. "súmate a mi pareja") */
  targetEntryId?: number
  /** Quien la use queda como admin de la polla (si aún no tiene dueño) */
  grantsAdmin?: boolean
}

export async function createInvite(
  pollaId: number,
  kind: EntryKind,
  options: CreateInviteOptions = {}
): Promise<Invite> {
  const db = await getDb()
  let code = generateCode()
  while ((await db.query('SELECT 1 FROM invites WHERE code = $1', [code])).length > 0) {
    code = generateCode()
  }
  await db.query(
    `INSERT INTO invites (code, polla_id, kind, label, entry_id, grants_admin, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      code,
      pollaId,
      kind,
      options.label?.trim() || null,
      options.targetEntryId ?? null,
      options.grantsAdmin ? 1 : 0,
      nowIso(),
    ]
  )
  return (await getInvite(code)) as Invite
}

export async function revokeInvite(code: string): Promise<void> {
  const db = await getDb()
  await db.query('UPDATE invites SET revoked = 1 WHERE code = $1', [code])
}

export interface InviteStatus extends Invite {
  /** Cupos de login que quedan en esta invitación */
  slotsLeft: number
  /** Nombre de la entrada asociada (cuando ya se usó o es de "únete a") */
  entryName: string | null
  usedBy: string[]
  pollaName: string | null
}

export async function getInviteStatus(code: string): Promise<InviteStatus | null> {
  const invite = await getInvite(code)
  if (!invite) return null
  const db = await getDb()

  const pollaRows = await db.query<{ name: string }>(
    'SELECT name FROM pollas WHERE id = $1',
    [invite.pollaId]
  )

  let entryName: string | null = null
  let usedBy: string[] = []
  let used = 0
  if (invite.entryId !== null) {
    const entryRows = await db.query<{ name: string }>(
      'SELECT name FROM entries WHERE id = $1',
      [invite.entryId]
    )
    entryName = entryRows[0]?.name ?? null
    const members = await db.query<{ display_name: string }>(
      `SELECT u.display_name FROM user_entries ue
       JOIN users u ON u.id = ue.user_id
       WHERE ue.entry_id = $1 ORDER BY ue.joined_at, u.id`,
      [invite.entryId]
    )
    usedBy = members.map((m) => m.display_name)
    used = members.length
  }

  const capacity = ENTRY_CAPACITY[invite.kind]
  return {
    ...invite,
    slotsLeft: invite.revoked ? 0 : Math.max(0, capacity - used),
    entryName,
    usedBy,
    pollaName: pollaRows[0]?.name ?? null,
  }
}

export async function listInviteStatuses(pollaId: number): Promise<InviteStatus[]> {
  const db = await getDb()
  const rows = await db.query<{ code: string }>(
    'SELECT code FROM invites WHERE polla_id = $1 ORDER BY created_at DESC',
    [pollaId]
  )
  const statuses: InviteStatus[] = []
  for (const row of rows) {
    const status = await getInviteStatus(row.code)
    if (status) statuses.push(status)
  }
  return statuses
}
