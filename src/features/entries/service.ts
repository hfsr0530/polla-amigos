import 'server-only'
import { getDb } from '@/shared/db/client'
import type { Entry, EntryKind, EntryWithMembers } from '@/shared/types/domain'

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
