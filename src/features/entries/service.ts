import 'server-only'
import { getDb } from '@/shared/db/client'
import type {
  Entry,
  EntryKind,
  EntryWithMemberAccounts,
  EntryWithMembers,
} from '@/shared/types/domain'

interface EntryRow {
  id: number
  polla_id: number
  name: string
  kind: EntryKind
  name_custom: number
}

function rowToEntry(r: EntryRow): Entry {
  return {
    id: r.id,
    pollaId: r.polla_id,
    name: r.name,
    kind: r.kind,
    nameCustom: r.name_custom === 1,
  }
}

export async function getEntry(id: number): Promise<Entry | null> {
  const db = await getDb()
  const rows = await db.query<EntryRow>(
    'SELECT id, polla_id, name, kind, name_custom FROM entries WHERE id = $1',
    [id]
  )
  return rows[0] ? rowToEntry(rows[0]) : null
}

/** Participantes de una polla con sus integrantes (orden alfabético) */
export async function listEntriesWithMembers(pollaId: number): Promise<EntryWithMembers[]> {
  const db = await getDb()
  const entries = (
    await db.query<EntryRow>(
      'SELECT id, polla_id, name, kind, name_custom FROM entries WHERE polla_id = $1 ORDER BY name',
      [pollaId]
    )
  ).map(rowToEntry)

  const memberRows = await db.query<{ entry_id: number; display_name: string }>(
    `SELECT ue.entry_id, u.display_name FROM user_entries ue
     JOIN users u ON u.id = ue.user_id
     JOIN entries e ON e.id = ue.entry_id
     WHERE e.polla_id = $1 ORDER BY ue.joined_at, u.id`,
    [pollaId]
  )

  const membersByEntry = new Map<number, string[]>()
  for (const m of memberRows) {
    const list = membersByEntry.get(m.entry_id) ?? []
    list.push(m.display_name)
    membersByEntry.set(m.entry_id, list)
  }

  return entries.map((e) => ({ ...e, members: membersByEntry.get(e.id) ?? [] }))
}

export async function countEntryMembers(entryId: number): Promise<number> {
  const db = await getDb()
  const rows = await db.query<{ n: number }>(
    'SELECT COUNT(*)::int AS n FROM user_entries WHERE entry_id = $1',
    [entryId]
  )
  return rows[0]?.n ?? 0
}

/** Participantes con sus cuentas (id incluido) para el panel de administración */
export async function listEntriesWithMemberAccounts(
  pollaId: number
): Promise<EntryWithMemberAccounts[]> {
  const db = await getDb()
  const entries = (
    await db.query<EntryRow>(
      'SELECT id, polla_id, name, kind, name_custom FROM entries WHERE polla_id = $1 ORDER BY name',
      [pollaId]
    )
  ).map(rowToEntry)

  const memberRows = await db.query<{
    entry_id: number
    user_id: number
    display_name: string
    is_superadmin: number
  }>(
    `SELECT ue.entry_id, u.id AS user_id, u.display_name, u.is_superadmin FROM user_entries ue
     JOIN users u ON u.id = ue.user_id
     JOIN entries e ON e.id = ue.entry_id
     WHERE e.polla_id = $1 ORDER BY ue.joined_at, u.id`,
    [pollaId]
  )

  const byEntry = new Map<number, EntryWithMemberAccounts['members']>()
  for (const m of memberRows) {
    const list = byEntry.get(m.entry_id) ?? []
    list.push({
      userId: m.user_id,
      displayName: m.display_name,
      isSuperadmin: m.is_superadmin === 1,
    })
    byEntry.set(m.entry_id, list)
  }

  return entries.map((e) => ({ ...e, members: byEntry.get(e.id) ?? [] }))
}

export interface RenameEntryResult {
  ok: boolean
  error?: string
}

/** Renombra una entrada (pareja o individual). El permiso se valida en la ruta. */
export async function renameEntry(entryId: number, name: string): Promise<RenameEntryResult> {
  const trimmed = name.trim()
  if (trimmed.length < 2 || trimmed.length > 40) {
    return { ok: false, error: 'El nombre debe tener entre 2 y 40 caracteres' }
  }
  const db = await getDb()
  const exists = await db.query('SELECT 1 FROM entries WHERE id = $1', [entryId])
  if (exists.length === 0) {
    return { ok: false, error: 'La entrada no existe' }
  }
  await db.query('UPDATE entries SET name = $1, name_custom = 1 WHERE id = $2', [trimmed, entryId])
  return { ok: true }
}

/** ¿El usuario es miembro de esta entrada? (para permitir renombrar la propia) */
export async function isEntryMember(userId: number, entryId: number): Promise<boolean> {
  const db = await getDb()
  const rows = await db.query('SELECT 1 FROM user_entries WHERE user_id = $1 AND entry_id = $2', [
    userId,
    entryId,
  ])
  return rows.length > 0
}
