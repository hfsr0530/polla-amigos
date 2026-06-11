// Tests de cambiar/resetear PIN sobre PGlite en memoria.
process.env.DATABASE_PATH = ':memory:'

import { describe, expect, it } from 'vitest'
import {
  registerUser,
  loginUser,
  changeMyPin,
  resetUserPin,
} from '@/features/auth/service'
import { createInvite } from '@/features/invites/service'

let pedroId: number

describe('escenario', () => {
  it('bootstrap + un invitado con PIN 1111', async () => {
    await registerUser({ username: 'harold', displayName: 'Harold', pin: '1234' })
    const inv = await createInvite(1, 'INDIVIDUAL', {})
    const pedro = await registerUser({
      username: 'pedro',
      displayName: 'Pedro',
      pin: '1111',
      inviteCode: inv.code,
    })
    pedroId = pedro.user!.id
    expect(pedroId).toBeGreaterThan(0)
  })
})

describe('changeMyPin', () => {
  it('rechaza si el PIN actual es incorrecto', async () => {
    const r = await changeMyPin(pedroId, '9999', '2222')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/actual/i)
  })

  it('rechaza un PIN nuevo inválido', async () => {
    expect((await changeMyPin(pedroId, '1111', '22')).ok).toBe(false)
  })

  it('cambia el PIN con el actual correcto y el login refleja el cambio', async () => {
    expect((await changeMyPin(pedroId, '1111', '2222')).ok).toBe(true)
    expect((await loginUser('pedro', '2222')).ok).toBe(true)
    expect((await loginUser('pedro', '1111')).ok).toBe(false)
  })
})

describe('resetUserPin (superadmin)', () => {
  it('asigna un PIN nuevo sin conocer el anterior', async () => {
    expect((await resetUserPin(pedroId, '7777')).ok).toBe(true)
    expect((await loginUser('pedro', '7777')).ok).toBe(true)
    // el PIN anterior ya no sirve
    expect((await loginUser('pedro', '2222')).ok).toBe(false)
  })

  it('valida el formato del PIN', async () => {
    expect((await resetUserPin(pedroId, 'abc')).ok).toBe(false)
  })

  it('falla si el usuario no existe', async () => {
    expect((await resetUserPin(99999, '4321')).ok).toBe(false)
  })
})
