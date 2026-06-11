// Test del override de edición de premios (el admin re-habilita aunque el
// horario ya los haya bloqueado). PGlite en memoria.
process.env.DATABASE_PATH = ':memory:'

import { describe, expect, it } from 'vitest'
import { registerUser } from '@/features/auth/service'
import { areAwardsLocked, saveAwardPick } from '@/features/awards/service'
import { setAwardsOpen, getPolla } from '@/features/pollas/service'
import { getDb } from '@/shared/db/client'

let entryId: number
let teamId: number

describe('habilitar edición de premios', () => {
  it('escenario: el torneo ya arrancó → premios bloqueados por horario', async () => {
    const h = await registerUser({ username: 'harold', displayName: 'Harold', pin: '1234' })
    entryId = h.user!.entryId
    const db = await getDb()
    // partido cuyo kickoff ya pasó: el inicio del torneo queda en el pasado
    await db.query(
      `INSERT INTO matches (stage, kickoff_utc, status) VALUES ('GROUP', $1, 'LIVE')`,
      [new Date(Date.now() - 60 * 60_000).toISOString()]
    )
    await db.query(`INSERT INTO teams (name) VALUES ('Brazil')`)
    teamId = Number((await db.query<{ id: number }>('SELECT id FROM teams LIMIT 1'))[0].id)

    expect(await areAwardsLocked(1)).toBe(true)
  })

  it('con el horario pasado, no se puede guardar un premio', async () => {
    const r = await saveAwardPick(entryId, 'CHAMPION', { teamId })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/cerrad/i)
  })

  it('el admin habilita la edición → se desbloquea y se puede guardar', async () => {
    await setAwardsOpen(1, true)
    expect((await getPolla(1))?.awardsOpen).toBe(true)
    expect(await areAwardsLocked(1)).toBe(false)
    expect((await saveAwardPick(entryId, 'CHAMPION', { teamId })).ok).toBe(true)
  })

  it('al volver al horario automático, se vuelve a bloquear', async () => {
    await setAwardsOpen(1, false)
    expect(await areAwardsLocked(1)).toBe(true)
  })
})
