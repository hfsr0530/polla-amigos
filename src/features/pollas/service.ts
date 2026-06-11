import 'server-only'
import { getDb, nowIso } from '@/shared/db/client'
import type { Polla } from '@/shared/types/domain'

interface PollaRow {
  id: number
  name: string
  admin_user_id: number | null
}

function rowToPolla(r: PollaRow): Polla {
  return { id: r.id, name: r.name, adminUserId: r.admin_user_id }
}

export async function getPolla(id: number): Promise<Polla | null> {
  const db = await getDb()
  const rows = await db.query<PollaRow>(
    'SELECT id, name, admin_user_id FROM pollas WHERE id = $1',
    [id]
  )
  return rows[0] ? rowToPolla(rows[0]) : null
}

export async function listPollas(): Promise<Polla[]> {
  const db = await getDb()
  const rows = await db.query<PollaRow>(
    'SELECT id, name, admin_user_id FROM pollas ORDER BY id'
  )
  return rows.map(rowToPolla)
}

export interface PollaStats extends Polla {
  adminName: string | null
  entryCount: number
  userCount: number
  /** Código de la invitación de admin aún sin usar (para copiar el link) */
  pendingAdminCode: string | null
}

export async function listPollasWithStats(): Promise<PollaStats[]> {
  const db = await getDb()
  const rows = await db.query<
    PollaRow & {
      admin_name: string | null
      entry_count: number
      user_count: number
      pending_admin_code: string | null
    }
  >(
    `SELECT p.id, p.name, p.admin_user_id,
            au.display_name AS admin_name,
            (SELECT COUNT(*)::int FROM entries e WHERE e.polla_id = p.id) AS entry_count,
            (SELECT COUNT(DISTINCT ue.user_id)::int FROM user_entries ue
              JOIN entries e ON e.id = ue.entry_id WHERE e.polla_id = p.id) AS user_count,
            (SELECT i.code FROM invites i
              WHERE i.polla_id = p.id AND i.grants_admin = 1 AND i.revoked = 0
                AND i.entry_id IS NULL
              ORDER BY i.created_at DESC LIMIT 1) AS pending_admin_code
     FROM pollas p
     LEFT JOIN users au ON au.id = p.admin_user_id
     ORDER BY p.id`
  )

  return rows.map((r) => ({
    ...rowToPolla(r),
    adminName: r.admin_name,
    entryCount: r.entry_count,
    userCount: r.user_count,
    pendingAdminCode: r.admin_user_id === null ? r.pending_admin_code : null,
  }))
}

/** Crea una polla nueva; el admin se designa con una invitación grants_admin */
export async function createPolla(name: string): Promise<Polla> {
  const db = await getDb()
  const trimmed = name.trim()
  const rows = await db.query<{ id: number }>(
    'INSERT INTO pollas (name, created_at) VALUES ($1, $2) RETURNING id',
    [trimmed, nowIso()]
  )
  return { id: rows[0].id, name: trimmed, adminUserId: null }
}

export async function isPollaAdmin(userId: number, pollaId: number): Promise<boolean> {
  const db = await getDb()
  const rows = await db.query(
    'SELECT 1 FROM pollas WHERE id = $1 AND admin_user_id = $2',
    [pollaId, userId]
  )
  return rows.length > 0
}
