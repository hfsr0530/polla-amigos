// Tests de las operaciones destructivas del superadmin (eliminar pollas/cuentas,
// renombrar entradas) sobre PGlite en memoria. Historia secuencial.
process.env.DATABASE_PATH = ':memory:'

import { describe, expect, it } from 'vitest'
import { registerUser, deleteUser } from '@/features/auth/service'
import { createInvite } from '@/features/invites/service'
import { createPolla, deletePolla, getPolla } from '@/features/pollas/service'
import {
  renameEntry,
  getEntry,
  isEntryMember,
  listEntriesWithMembers,
} from '@/features/entries/service'
import { savePrediction, getEntryPredictions } from '@/features/predictions/service'
import { getDb } from '@/shared/db/client'

let haroldId: number
let pedroId: number
let pedroEntryId: number
let juanId: number
let caroId: number
let cracksEntryId: number
let polla2Id: number
let jefaId: number
let empleadoId: number
let matchId: number

function reg(username: string, displayName: string, opts: { inviteCode?: string; pairName?: string } = {}) {
  return registerUser({ username, displayName, pin: '1234', ...opts })
}

describe('escenario', () => {
  it('arma pollas, parejas, individuales y pronósticos', async () => {
    haroldId = (await reg('harold', 'Harold')).user!.id

    const inv1 = await createInvite(1, 'INDIVIDUAL', {})
    const pedro = await reg('pedro', 'Pedro', { inviteCode: inv1.code })
    pedroId = pedro.user!.id
    pedroEntryId = pedro.user!.entryId

    const invPair = await createInvite(1, 'PAIR', {})
    const juan = await reg('juan', 'Juan', { inviteCode: invPair.code, pairName: 'Los Cracks' })
    const caro = await reg('caro', 'Caro', { inviteCode: invPair.code })
    juanId = juan.user!.id
    caroId = caro.user!.id
    cracksEntryId = juan.user!.entryId

    polla2Id = (await createPolla('Polla Oficina')).id
    const adminInv = await createInvite(polla2Id, 'INDIVIDUAL', { grantsAdmin: true })
    jefaId = (await reg('jefa', 'Jefa', { inviteCode: adminInv.code })).user!.id
    const empInv = await createInvite(polla2Id, 'INDIVIDUAL', {})
    empleadoId = (await reg('empleado', 'Empleado', { inviteCode: empInv.code })).user!.id

    const db = await getDb()
    await db.query(
      `INSERT INTO matches (stage, kickoff_utc, status) VALUES ('GROUP', $1, 'SCHEDULED')`,
      [new Date(Date.now() + 60 * 60_000).toISOString()]
    )
    matchId = Number((await db.query<{ id: number }>('SELECT MAX(id) AS id FROM matches'))[0].id)
    await savePrediction(pedroEntryId, matchId, 1, 0)
    await savePrediction(cracksEntryId, matchId, 2, 2)

    expect((await getPolla(polla2Id))?.adminUserId).toBe(jefaId)
  })
})

describe('renameEntry', () => {
  it('renombra una pareja', async () => {
    expect((await renameEntry(cracksEntryId, 'Los Galácticos')).ok).toBe(true)
    expect((await getEntry(cracksEntryId))?.name).toBe('Los Galácticos')
  })
  it('rechaza nombres inválidos', async () => {
    expect((await renameEntry(cracksEntryId, 'x')).ok).toBe(false)
  })
  it('isEntryMember distingue dueños', async () => {
    expect(await isEntryMember(juanId, cracksEntryId)).toBe(true)
    expect(await isEntryMember(pedroId, cracksEntryId)).toBe(false)
  })
})

describe('deleteUser', () => {
  it('no permite borrarse a sí mismo ni a un superadmin', async () => {
    expect((await deleteUser(haroldId, haroldId)).ok).toBe(false)
    expect((await deleteUser(haroldId, pedroId)).ok).toBe(false)
  })

  it('borra una cuenta individual con su entrada y pronósticos', async () => {
    expect((await deleteUser(pedroId, haroldId)).ok).toBe(true)
    expect(await getEntry(pedroEntryId)).toBeNull()
    const db = await getDb()
    expect((await db.query('SELECT 1 FROM predictions WHERE entry_id = $1', [pedroEntryId])).length).toBe(0)
    expect((await db.query('SELECT 1 FROM users WHERE id = $1', [pedroId])).length).toBe(0)
  })

  it('borrar un miembro de la pareja deja la entrada y el pronóstico compartido', async () => {
    expect((await deleteUser(caroId, haroldId)).ok).toBe(true)
    expect(await getEntry(cracksEntryId)).not.toBeNull()
    expect((await getEntryPredictions(cracksEntryId)).get(matchId)).toMatchObject({
      homeGoals: 2,
      awayGoals: 2,
    })
    expect(await isEntryMember(juanId, cracksEntryId)).toBe(true)
    expect(await isEntryMember(caroId, cracksEntryId)).toBe(false)
  })

  it('borrar al admin de una polla la deja sin admin', async () => {
    expect((await deleteUser(jefaId, haroldId)).ok).toBe(true)
    expect((await getPolla(polla2Id))?.adminUserId).toBeNull()
  })
})

describe('deletePolla', () => {
  it('elimina la polla con sus participantes huérfanos', async () => {
    expect((await deletePolla(polla2Id)).ok).toBe(true)
    expect(await getPolla(polla2Id)).toBeNull()
    const db = await getDb()
    expect((await db.query('SELECT 1 FROM users WHERE id = $1', [empleadoId])).length).toBe(0)
    expect((await listEntriesWithMembers(polla2Id)).length).toBe(0)
  })

  it('no permite borrar la última polla', async () => {
    const r = await deletePolla(1)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/única/i)
  })

  it('los datos de la polla 1 siguen intactos', async () => {
    const entries = await listEntriesWithMembers(1)
    expect(entries.some((e) => e.name === 'Los Galácticos')).toBe(true)
    expect(entries.some((e) => e.name === 'Harold')).toBe(true)
  })
})
