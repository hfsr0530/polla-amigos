import 'server-only'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { getDb, nowIso, type DbClient } from '@/shared/db/client'
import {
  ENTRY_CAPACITY,
  type EntryKind,
  type Membership,
  type SessionUser,
} from '@/shared/types/domain'

interface UserRow {
  id: number
  username: string
  display_name: string
  pin_hash: string
  is_superadmin: number
  entry_id: number
}

function hashPin(pin: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(pin, salt, 64)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

function verifyPin(pin: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = scryptSync(pin, Buffer.from(saltHex, 'hex'), expected.length)
  return timingSafeEqual(expected, actual)
}

export interface AuthResult {
  ok: boolean
  error?: string
  user?: SessionUser
}

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,20}$/
const PIN_RE = /^\d{4,6}$/
const DEFAULT_POLLA_NAME = 'Polla Amigos'

export async function registrationNeedsInvite(): Promise<boolean> {
  const db = await getDb()
  const rows = await db.query<{ n: number }>('SELECT COUNT(*)::int AS n FROM users')
  return (rows[0]?.n ?? 0) > 0
}

async function buildSessionUser(
  db: DbClient,
  row: {
    id: number
    username: string
    displayName: string
    isSuperadmin: boolean
    entryId: number
  }
): Promise<SessionUser> {
  const entryRows = await db.query<{ polla_id: number }>(
    'SELECT polla_id FROM entries WHERE id = $1',
    [row.entryId]
  )
  const pollaId = entryRows[0]?.polla_id ?? 0
  const isPollaAdmin = pollaId
    ? (
        await db.query('SELECT 1 FROM pollas WHERE id = $1 AND admin_user_id = $2', [
          pollaId,
          row.id,
        ])
      ).length > 0
    : false
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    entryId: row.entryId,
    pollaId,
    isPollaAdmin,
    isSuperadmin: row.isSuperadmin,
  }
}

interface InviteRowShape {
  code: string
  polla_id: number
  kind: EntryKind
  entry_id: number | null
  grants_admin: number
  revoked: number
}

type ConsumeResult = { ok: true; entryId: number } | { ok: false; error: string }

/**
 * Consume una invitación: crea la entrada (individual/pareja) o une a una
 * existente. Corre dentro de la transacción del caller.
 */
async function consumeInvite(
  tx: DbClient,
  invite: InviteRowShape,
  displayName: string,
  pairName: string
): Promise<ConsumeResult> {
  if (invite.entry_id === null) {
    const isPair = invite.kind === 'PAIR'
    const entryName = isPair && pairName ? pairName : displayName
    const rows = await tx.query<{ id: number }>(
      `INSERT INTO entries (polla_id, name, kind, name_custom, created_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [invite.polla_id, entryName, invite.kind, isPair && pairName ? 1 : 0, nowIso()]
    )
    const entryId = rows[0].id
    await tx.query('UPDATE invites SET entry_id = $1 WHERE code = $2', [entryId, invite.code])
    return { ok: true, entryId }
  }

  const entryRows = await tx.query<{
    id: number
    name: string
    kind: EntryKind
    name_custom: number
  }>('SELECT id, name, kind, name_custom FROM entries WHERE id = $1', [invite.entry_id])
  const entry = entryRows[0]
  if (!entry) {
    return { ok: false, error: 'La invitación apunta a una entrada que ya no existe' }
  }

  const capacity = ENTRY_CAPACITY[invite.kind]
  const members = await tx.query<{ display_name: string }>(
    `SELECT u.display_name FROM user_entries ue
     JOIN users u ON u.id = ue.user_id
     WHERE ue.entry_id = $1 ORDER BY ue.joined_at, u.id`,
    [entry.id]
  )
  if (members.length >= capacity) {
    return { ok: false, error: 'Esta invitación ya fue usada por completo' }
  }

  if (invite.kind === 'PAIR') {
    const newCustom = pairName ? 1 : entry.name_custom
    const newName = pairName
      ? pairName
      : entry.name_custom === 1 && entry.kind === 'PAIR'
        ? entry.name
        : `${members[0]?.display_name ?? entry.name} & ${displayName}`
    await tx.query('UPDATE entries SET kind = $1, name = $2, name_custom = $3 WHERE id = $4', [
      'PAIR',
      newName,
      newCustom,
      entry.id,
    ])
  }
  return { ok: true, entryId: entry.id }
}

async function userParticipatesInPolla(
  tx: DbClient,
  userId: number,
  pollaId: number
): Promise<boolean> {
  const rows = await tx.query(
    `SELECT 1 FROM user_entries ue JOIN entries e ON e.id = ue.entry_id
     WHERE ue.user_id = $1 AND e.polla_id = $2`,
    [userId, pollaId]
  )
  return rows.length > 0
}

async function grantAdminIfPending(
  tx: DbClient,
  invite: InviteRowShape,
  userId: number
): Promise<void> {
  if (invite.grants_admin !== 1) return
  await tx.query(
    'UPDATE pollas SET admin_user_id = $1 WHERE id = $2 AND admin_user_id IS NULL',
    [userId, invite.polla_id]
  )
}

export interface RegisterParams {
  username: string
  displayName: string
  pin: string
  inviteCode?: string
  pairName?: string
}

export async function registerUser(params: RegisterParams): Promise<AuthResult> {
  const { username, pin } = params
  const displayName = params.displayName.trim()
  const pairName = params.pairName?.trim() ?? ''

  if (!USERNAME_RE.test(username)) {
    return { ok: false, error: 'El usuario debe tener 3-20 caracteres (letras, números, _ . -)' }
  }
  if (!PIN_RE.test(pin)) {
    return { ok: false, error: 'El PIN debe ser de 4 a 6 dígitos' }
  }
  if (displayName.length < 2 || displayName.length > 40) {
    return { ok: false, error: 'El nombre debe tener entre 2 y 40 caracteres' }
  }
  if (pairName.length > 40) {
    return { ok: false, error: 'El nombre de la pareja no puede pasar de 40 caracteres' }
  }

  const db = await getDb()
  const existing = await db.query('SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)', [
    username,
  ])
  if (existing.length > 0) {
    return { ok: false, error: 'Ese usuario ya existe' }
  }

  return db.transaction(async (tx): Promise<AuthResult> => {
    const userCount = await tx.query<{ n: number }>('SELECT COUNT(*)::int AS n FROM users')
    const isBootstrap = (userCount[0]?.n ?? 0) === 0
    let entryId: number
    let invite: InviteRowShape | undefined

    if (isBootstrap) {
      // Primera cuenta del sistema: superadmin, con su polla y entrada propias
      let pollaRows = await tx.query<{ id: number }>('SELECT id FROM pollas ORDER BY id LIMIT 1')
      if (pollaRows.length === 0) {
        pollaRows = await tx.query<{ id: number }>(
          'INSERT INTO pollas (name, created_at) VALUES ($1, $2) RETURNING id',
          [DEFAULT_POLLA_NAME, nowIso()]
        )
      }
      const entryRows = await tx.query<{ id: number }>(
        `INSERT INTO entries (polla_id, name, kind, name_custom, created_at)
         VALUES ($1, $2, 'INDIVIDUAL', 1, $3) RETURNING id`,
        [pollaRows[0].id, displayName, nowIso()]
      )
      entryId = entryRows[0].id
    } else {
      const code = params.inviteCode?.trim().toUpperCase() ?? ''
      if (!code) {
        return { ok: false, error: 'Necesitas un código de invitación' }
      }
      const inviteRows = await tx.query<InviteRowShape>(
        'SELECT * FROM invites WHERE code = $1',
        [code]
      )
      invite = inviteRows[0]
      if (!invite || invite.revoked === 1) {
        return { ok: false, error: 'Invitación inválida o revocada' }
      }
      const consumed = await consumeInvite(tx, invite, displayName, pairName)
      if (!consumed.ok) return consumed
      entryId = consumed.entryId
    }

    const userRows = await tx.query<{ id: number }>(
      `INSERT INTO users (username, display_name, pin_hash, is_superadmin, entry_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [username, displayName, hashPin(pin), isBootstrap ? 1 : 0, entryId, nowIso()]
    )
    const userId = userRows[0].id
    await tx.query('INSERT INTO user_entries (user_id, entry_id, joined_at) VALUES ($1, $2, $3)', [
      userId,
      entryId,
      nowIso(),
    ])

    if (isBootstrap) {
      await tx.query(
        `UPDATE pollas SET admin_user_id = $1
         WHERE admin_user_id IS NULL AND id = (SELECT polla_id FROM entries WHERE id = $2)`,
        [userId, entryId]
      )
    } else if (invite) {
      await grantAdminIfPending(tx, invite, userId)
    }

    return {
      ok: true,
      user: await buildSessionUser(tx, {
        id: userId,
        username,
        displayName,
        isSuperadmin: isBootstrap,
        entryId,
      }),
    }
  })
}

async function getUserRow(db: DbClient, userId: number): Promise<UserRow | undefined> {
  const rows = await db.query<UserRow>(
    'SELECT id, username, display_name, pin_hash, is_superadmin, entry_id FROM users WHERE id = $1',
    [userId]
  )
  return rows[0]
}

/** Un usuario logueado se une a OTRA polla con un código de invitación */
export async function joinWithInvite(
  userId: number,
  code: string,
  pairName = ''
): Promise<AuthResult> {
  const db = await getDb()
  const userRow = await getUserRow(db, userId)
  if (!userRow) return { ok: false, error: 'Usuario inexistente' }
  if (pairName.trim().length > 40) {
    return { ok: false, error: 'El nombre de la pareja no puede pasar de 40 caracteres' }
  }

  return db.transaction(async (tx): Promise<AuthResult> => {
    const inviteRows = await tx.query<InviteRowShape>('SELECT * FROM invites WHERE code = $1', [
      code.trim().toUpperCase(),
    ])
    const invite = inviteRows[0]
    if (!invite || invite.revoked === 1) {
      return { ok: false, error: 'Invitación inválida o revocada' }
    }
    if (await userParticipatesInPolla(tx, userId, invite.polla_id)) {
      return { ok: false, error: 'Ya participas en esta polla' }
    }

    const consumed = await consumeInvite(tx, invite, userRow.display_name, pairName.trim())
    if (!consumed.ok) return consumed

    await tx.query('INSERT INTO user_entries (user_id, entry_id, joined_at) VALUES ($1, $2, $3)', [
      userId,
      consumed.entryId,
      nowIso(),
    ])
    await tx.query('UPDATE users SET entry_id = $1 WHERE id = $2', [consumed.entryId, userId])
    await grantAdminIfPending(tx, invite, userId)

    return {
      ok: true,
      user: await buildSessionUser(tx, {
        id: userRow.id,
        username: userRow.username,
        displayName: userRow.display_name,
        isSuperadmin: userRow.is_superadmin === 1,
        entryId: consumed.entryId,
      }),
    }
  })
}

/** El superadmin entra a jugar en cualquier polla sin invitación */
export async function joinPollaDirect(userId: number, pollaId: number): Promise<AuthResult> {
  const db = await getDb()
  const userRow = await getUserRow(db, userId)
  if (!userRow) return { ok: false, error: 'Usuario inexistente' }
  if (userRow.is_superadmin !== 1) {
    return { ok: false, error: 'Solo el superadmin puede unirse sin invitación' }
  }
  const pollaExists = await db.query('SELECT 1 FROM pollas WHERE id = $1', [pollaId])
  if (pollaExists.length === 0) {
    return { ok: false, error: 'La polla no existe' }
  }

  return db.transaction(async (tx): Promise<AuthResult> => {
    if (await userParticipatesInPolla(tx, userId, pollaId)) {
      return { ok: false, error: 'Ya participas en esta polla' }
    }
    const entryRows = await tx.query<{ id: number }>(
      `INSERT INTO entries (polla_id, name, kind, name_custom, created_at)
       VALUES ($1, $2, 'INDIVIDUAL', 1, $3) RETURNING id`,
      [pollaId, userRow.display_name, nowIso()]
    )
    const entryId = entryRows[0].id
    await tx.query('INSERT INTO user_entries (user_id, entry_id, joined_at) VALUES ($1, $2, $3)', [
      userId,
      entryId,
      nowIso(),
    ])
    await tx.query('UPDATE users SET entry_id = $1 WHERE id = $2', [entryId, userId])

    return {
      ok: true,
      user: await buildSessionUser(tx, {
        id: userRow.id,
        username: userRow.username,
        displayName: userRow.display_name,
        isSuperadmin: true,
        entryId,
      }),
    }
  })
}

/** Cambia la polla activa de la sesión (debe ser una membresía propia) */
export async function switchActiveEntry(userId: number, entryId: number): Promise<AuthResult> {
  const db = await getDb()
  const userRow = await getUserRow(db, userId)
  if (!userRow) return { ok: false, error: 'Usuario inexistente' }
  const membership = await db.query(
    'SELECT 1 FROM user_entries WHERE user_id = $1 AND entry_id = $2',
    [userId, entryId]
  )
  if (membership.length === 0) {
    return { ok: false, error: 'No participas con esa entrada' }
  }
  await db.query('UPDATE users SET entry_id = $1 WHERE id = $2', [entryId, userId])
  return {
    ok: true,
    user: await buildSessionUser(db, {
      id: userRow.id,
      username: userRow.username,
      displayName: userRow.display_name,
      isSuperadmin: userRow.is_superadmin === 1,
      entryId,
    }),
  }
}

export async function getUserMemberships(userId: number): Promise<Membership[]> {
  const db = await getDb()
  const userRow = await getUserRow(db, userId)
  const active = userRow?.entry_id ?? 0
  const rows = await db.query<{
    entry_id: number
    entry_name: string
    kind: EntryKind
    polla_id: number
    polla_name: string
  }>(
    `SELECT e.id AS entry_id, e.name AS entry_name, e.kind, e.polla_id, p.name AS polla_name
     FROM user_entries ue
     JOIN entries e ON e.id = ue.entry_id
     JOIN pollas p ON p.id = e.polla_id
     WHERE ue.user_id = $1 ORDER BY p.id`,
    [userId]
  )
  return rows.map((r) => ({
    entryId: r.entry_id,
    entryName: r.entry_name,
    kind: r.kind,
    pollaId: r.polla_id,
    pollaName: r.polla_name,
    isActive: r.entry_id === active,
  }))
}

export async function loginUser(username: string, pin: string): Promise<AuthResult> {
  const db = await getDb()
  const rows = await db.query<UserRow>(
    `SELECT id, username, display_name, pin_hash, is_superadmin, entry_id
     FROM users WHERE LOWER(username) = LOWER($1)`,
    [username]
  )
  const row = rows[0]

  if (!row || !verifyPin(pin, row.pin_hash)) {
    return { ok: false, error: 'Usuario o PIN incorrectos' }
  }

  return {
    ok: true,
    user: await buildSessionUser(db, {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      isSuperadmin: row.is_superadmin === 1,
      entryId: row.entry_id,
    }),
  }
}

export interface DeleteUserResult {
  ok: boolean
  error?: string
}

/**
 * Elimina una cuenta (solo el superadmin). Reglas:
 *  - no puede eliminarse a sí mismo ni a otro superadmin
 *  - si la cuenta es la única de su entrada → se borra la entrada con sus
 *    pronósticos y premios; si comparte entrada (pareja), solo se quita la cuenta
 *  - si era admin de alguna polla, esa polla queda sin admin (el superadmin
 *    sigue gestionándola)
 */
export async function deleteUser(targetId: number, actingId: number): Promise<DeleteUserResult> {
  if (targetId === actingId) {
    return { ok: false, error: 'No puedes eliminar tu propia cuenta' }
  }
  const db = await getDb()
  return db.transaction(async (tx): Promise<DeleteUserResult> => {
    const target = (
      await tx.query<{ id: number; is_superadmin: number }>(
        'SELECT id, is_superadmin FROM users WHERE id = $1',
        [targetId]
      )
    )[0]
    if (!target) return { ok: false, error: 'El usuario no existe' }
    if (target.is_superadmin === 1) {
      return { ok: false, error: 'No puedes eliminar a un superadministrador' }
    }

    // Entradas donde el target es el ÚNICO miembro (se borran con él)
    const soloEntries = (
      await tx.query<{ entry_id: number }>(
        `SELECT ue.entry_id FROM user_entries ue
         WHERE ue.user_id = $1
           AND (SELECT COUNT(*) FROM user_entries x WHERE x.entry_id = ue.entry_id) = 1`,
        [targetId]
      )
    ).map((r) => r.entry_id)

    // pollas.admin_user_id no tiene cascade: hay que soltarla antes de borrar
    await tx.query('UPDATE pollas SET admin_user_id = NULL WHERE admin_user_id = $1', [targetId])

    // invites.entry_id tampoco: borrar invites de las entradas que se van
    for (const eid of soloEntries) {
      await tx.query('DELETE FROM invites WHERE entry_id = $1', [eid])
    }

    // Borrar la cuenta (cascade quita sus user_entries; en parejas, el otro queda)
    await tx.query('DELETE FROM users WHERE id = $1', [targetId])

    // Borrar las entradas que quedaron sin nadie (cascade: predictions, award_picks)
    for (const eid of soloEntries) {
      await tx.query('DELETE FROM entries WHERE id = $1', [eid])
    }

    return { ok: true }
  })
}

export interface PinResult {
  ok: boolean
  error?: string
}

/** Un usuario cambia su propio PIN (verificando el actual). */
export async function changeMyPin(
  userId: number,
  currentPin: string,
  newPin: string
): Promise<PinResult> {
  if (!PIN_RE.test(newPin)) {
    return { ok: false, error: 'El PIN debe ser de 4 a 6 dígitos' }
  }
  const db = await getDb()
  const rows = await db.query<{ pin_hash: string }>('SELECT pin_hash FROM users WHERE id = $1', [
    userId,
  ])
  if (!rows[0]) return { ok: false, error: 'El usuario no existe' }
  if (!verifyPin(currentPin, rows[0].pin_hash)) {
    return { ok: false, error: 'PIN actual incorrecto' }
  }
  await db.query('UPDATE users SET pin_hash = $1 WHERE id = $2', [hashPin(newPin), userId])
  return { ok: true }
}

/**
 * El superadmin asigna un PIN nuevo a una cuenta (sin borrarla ni perder sus
 * pronósticos). El permiso se valida en la ruta. El PIN nunca se muestra: solo
 * se reemplaza el hash.
 */
export async function resetUserPin(targetId: number, newPin: string): Promise<PinResult> {
  if (!PIN_RE.test(newPin)) {
    return { ok: false, error: 'El PIN debe ser de 4 a 6 dígitos' }
  }
  const db = await getDb()
  const exists = await db.query('SELECT 1 FROM users WHERE id = $1', [targetId])
  if (exists.length === 0) return { ok: false, error: 'El usuario no existe' }
  await db.query('UPDATE users SET pin_hash = $1 WHERE id = $2', [hashPin(newPin), targetId])
  return { ok: true }
}

export interface UserSummary {
  id: number
  displayName: string
  entryId: number
  isSuperadmin: boolean
}

/** Cuentas de una polla (la entrada reportada es la de ESA polla) */
export async function listUsers(pollaId?: number): Promise<UserSummary[]> {
  const db = await getDb()
  const rows = (
    pollaId !== undefined
      ? await db.query<{
          id: number
          display_name: string
          entry_id: number
          is_superadmin: number
        }>(
          `SELECT u.id, u.display_name, ue.entry_id, u.is_superadmin
           FROM user_entries ue
           JOIN users u ON u.id = ue.user_id
           JOIN entries e ON e.id = ue.entry_id
           WHERE e.polla_id = $1 ORDER BY u.display_name`,
          [pollaId]
        )
      : await db.query<{
          id: number
          display_name: string
          entry_id: number
          is_superadmin: number
        }>('SELECT id, display_name, entry_id, is_superadmin FROM users ORDER BY display_name')
  )
  return rows.map((r) => ({
    id: r.id,
    displayName: r.display_name,
    entryId: r.entry_id,
    isSuperadmin: r.is_superadmin === 1,
  }))
}
