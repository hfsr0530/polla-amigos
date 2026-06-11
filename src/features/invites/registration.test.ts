// Test de integración del flujo de invitaciones, parejas y multi-polla sobre
// PGlite (Postgres embebido) en memoria. Es una historia secuencial: cada
// describe depende del anterior.
process.env.DATABASE_PATH = ':memory:'

import { describe, expect, it } from 'vitest'
import {
  getUserMemberships,
  joinPollaDirect,
  joinWithInvite,
  registerUser,
  registrationNeedsInvite,
  switchActiveEntry,
} from '@/features/auth/service'
import { createInvite, getInviteStatus, revokeInvite } from '@/features/invites/service'
import { getEntry, listEntriesWithMembers } from '@/features/entries/service'
import { createPolla, getPolla, listPollasWithStats } from '@/features/pollas/service'
import { getDb, nowIso } from '@/shared/db/client'
import {
  savePrediction,
  getEntryPredictions,
  getAllPredictions,
} from '@/features/predictions/service'
import {
  saveAwardPick,
  setAwardResult,
  getEntryAwardPicks,
  getAwardResults,
  isPickCorrect,
} from '@/features/awards/service'
import { applyProviderMatches } from '@/features/livescore/sync'
import type { ProviderMatch } from '@/features/livescore/provider'

function register(
  username: string,
  displayName: string,
  opts: { inviteCode?: string; pairName?: string } = {}
) {
  return registerUser({ username, displayName, pin: '1234', ...opts })
}

const POLLA_1 = 1

describe('bootstrap', () => {
  it('la primera cuenta entra sin código: superadmin y admin de su polla', async () => {
    expect(await registrationNeedsInvite()).toBe(false)
    const result = await register('harold', 'Harold')
    expect(result.ok).toBe(true)
    expect(result.user?.isSuperadmin).toBe(true)
    expect(result.user?.isPollaAdmin).toBe(true)
    expect(result.user?.pollaId).toBe(POLLA_1)
    expect((await getPolla(POLLA_1))?.name).toBe('Polla Amigos')
    expect((await getEntry(result.user!.entryId))?.kind).toBe('INDIVIDUAL')
  })

  it('la segunda cuenta ya exige invitación', async () => {
    expect(await registrationNeedsInvite()).toBe(true)
    const result = await register('colado', 'Colado')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/invitación/i)
  })
})

describe('invitación individual', () => {
  it('permite registrar exactamente una cuenta', async () => {
    const inv = await createInvite(POLLA_1, 'INDIVIDUAL', { label: 'Para Pedro' })
    const first = await register('pedro', 'Pedro', { inviteCode: inv.code })
    expect(first.ok).toBe(true)
    expect(first.user?.pollaId).toBe(POLLA_1)
    expect(first.user?.isPollaAdmin).toBe(false)

    const second = await register('maria', 'María', { inviteCode: inv.code })
    expect(second.ok).toBe(false)
    expect(second.error).toMatch(/ya fue usada/i)
  })

  it('los códigos no distinguen mayúsculas', async () => {
    const inv = await createInvite(POLLA_1, 'INDIVIDUAL', {})
    const result = await register('lucho', 'Lucho', { inviteCode: inv.code.toLowerCase() })
    expect(result.ok).toBe(true)
  })
})

describe('invitación de pareja', () => {
  it('dos cuentas comparten la misma entrada y el nombre elegido', async () => {
    const inv = await createInvite(POLLA_1, 'PAIR', { label: 'Los primos' })
    const a = await register('juan', 'Juan', { inviteCode: inv.code, pairName: 'Los Cracks' })
    expect(a.ok).toBe(true)

    const b = await register('caro', 'Caro', { inviteCode: inv.code })
    expect(b.ok).toBe(true)
    expect(b.user!.entryId).toBe(a.user!.entryId)

    const entry = await getEntry(a.user!.entryId)
    expect(entry?.kind).toBe('PAIR')
    expect(entry?.name).toBe('Los Cracks')

    const c = await register('intruso', 'Intruso', { inviteCode: inv.code })
    expect(c.ok).toBe(false)
  })

  it('sin nombre de pareja se autogenera "A & B"', async () => {
    const inv = await createInvite(POLLA_1, 'PAIR', {})
    const a = await register('rosa', 'Rosa', { inviteCode: inv.code })
    const b = await register('leo', 'Leo', { inviteCode: inv.code })
    expect(a.ok && b.ok).toBe(true)
    expect((await getEntry(a.user!.entryId))?.name).toBe('Rosa & Leo')
  })

  it('el segundo puede renombrar la pareja si el nombre era autogenerado', async () => {
    const inv = await createInvite(POLLA_1, 'PAIR', {})
    await register('nina', 'Nina', { inviteCode: inv.code })
    const b = await register('tato', 'Tato', { inviteCode: inv.code, pairName: 'Tiki-Taka' })
    expect((await getEntry(b.user!.entryId))?.name).toBe('Tiki-Taka')
  })
})

describe('únete a mi entrada (el admin arma su pareja)', () => {
  it('convierte la entrada individual del admin en pareja', async () => {
    const adminEntryId = 1 // la entry del bootstrap
    const inv = await createInvite(POLLA_1, 'PAIR', {
      label: 'Mi pareja',
      targetEntryId: adminEntryId,
    })
    const result = await register('esposa', 'Diana', { inviteCode: inv.code })
    expect(result.ok).toBe(true)
    expect(result.user!.entryId).toBe(adminEntryId)
    expect((await getEntry(adminEntryId))?.name).toBe('Harold & Diana')
  })
})

describe('revocación y estado', () => {
  it('una invitación revocada no sirve', async () => {
    const inv = await createInvite(POLLA_1, 'INDIVIDUAL', {})
    await revokeInvite(inv.code)
    const result = await register('tarde', 'Tarde', { inviteCode: inv.code })
    expect(result.ok).toBe(false)
  })

  it('el estado refleja cupos, usuarios y polla', async () => {
    const inv = await createInvite(POLLA_1, 'PAIR', { label: 'Estado' })
    expect((await getInviteStatus(inv.code))?.slotsLeft).toBe(2)
    expect((await getInviteStatus(inv.code))?.pollaName).toBe('Polla Amigos')
    await register('uno', 'Uno', { inviteCode: inv.code })
    const status = await getInviteStatus(inv.code)
    expect(status?.slotsLeft).toBe(1)
    expect(status?.usedBy).toEqual(['Uno'])
  })
})

describe('multi-polla y superadmin', () => {
  let polla2Id: number

  it('el superadmin crea otra polla y la entrega con un código de admin', async () => {
    const polla2 = await createPolla('Polla Oficina')
    polla2Id = polla2.id
    expect(polla2.adminUserId).toBeNull()

    const adminInv = await createInvite(polla2Id, 'INDIVIDUAL', {
      label: 'Admin de Polla Oficina',
      grantsAdmin: true,
    })
    const boss = await register('jefe', 'La Jefa', { inviteCode: adminInv.code })
    expect(boss.ok).toBe(true)
    expect(boss.user?.pollaId).toBe(polla2Id)
    expect(boss.user?.isPollaAdmin).toBe(true)
    expect(boss.user?.isSuperadmin).toBe(false)
    expect((await getPolla(polla2Id))?.adminUserId).toBe(boss.user!.id)
  })

  it('un segundo código de admin ya no roba la polla', async () => {
    const inv = await createInvite(polla2Id, 'INDIVIDUAL', { grantsAdmin: true })
    const result = await register('avivato', 'Avivato', { inviteCode: inv.code })
    expect(result.ok).toBe(true)
    expect(result.user?.isPollaAdmin).toBe(false)
    expect((await getPolla(polla2Id))?.adminUserId).not.toBe(result.user!.id)
  })

  it('cada polla solo ve a su gente', async () => {
    const polla1Names = (await listEntriesWithMembers(POLLA_1)).map((e) => e.name)
    const polla2Names = (await listEntriesWithMembers(polla2Id)).map((e) => e.name)
    expect(polla1Names).toContain('Los Cracks')
    expect(polla1Names).not.toContain('La Jefa')
    expect(polla2Names).toContain('La Jefa')
    expect(polla2Names).not.toContain('Los Cracks')
  })

  it('las estadísticas del panel de pollas cuadran', async () => {
    const stats = await listPollasWithStats()
    const oficina = stats.find((p) => p.id === polla2Id)
    expect(oficina?.adminName).toBe('La Jefa')
    expect(oficina?.userCount).toBe(2)
    expect(oficina?.pendingAdminCode).toBeNull()
  })

  it('el superadmin se une directo a otra polla y puede alternar', async () => {
    const harold = 1 // bootstrap
    const before = await getUserMemberships(harold)
    expect(before).toHaveLength(1)
    expect(before[0].pollaName).toBe('Polla Amigos')

    const joined = await joinPollaDirect(harold, polla2Id)
    expect(joined.ok).toBe(true)
    expect(joined.user?.pollaId).toBe(polla2Id)
    expect(joined.user?.isSuperadmin).toBe(true)
    // en la polla de La Jefa no es admin de polla
    expect(joined.user?.isPollaAdmin).toBe(false)

    const after = await getUserMemberships(harold)
    expect(after).toHaveLength(2)
    expect(after.find((m) => m.pollaId === polla2Id)?.isActive).toBe(true)

    // no puede unirse dos veces a la misma polla
    expect((await joinPollaDirect(harold, polla2Id)).ok).toBe(false)

    // vuelve a su polla original
    const homeEntry = after.find((m) => m.pollaId === POLLA_1)
    const switched = await switchActiveEntry(harold, homeEntry!.entryId)
    expect(switched.ok).toBe(true)
    expect(switched.user?.pollaId).toBe(POLLA_1)
    expect(switched.user?.isPollaAdmin).toBe(true)

    // no puede activar una entrada ajena
    const jefaEntry = (await listEntriesWithMembers(polla2Id)).find((e) => e.name === 'La Jefa')
    expect((await switchActiveEntry(harold, jefaEntry!.id)).ok).toBe(false)
  })

  it('un usuario normal se une a otra polla con un código', async () => {
    // Pedro (polla 1) recibe invitación de la Polla Oficina
    const inv = await createInvite(polla2Id, 'INDIVIDUAL', { label: 'Cruce' })
    const pedro = 2 // segundo usuario registrado
    const joined = await joinWithInvite(pedro, inv.code)
    expect(joined.ok).toBe(true)
    expect(joined.user?.pollaId).toBe(polla2Id)
    expect(await getUserMemberships(pedro)).toHaveLength(2)

    // el mismo código no le sirve para repetir polla
    const again = await joinWithInvite(pedro, (await createInvite(polla2Id, 'INDIVIDUAL', {})).code)
    expect(again.ok).toBe(false)
    expect(again.error).toMatch(/ya participas/i)

    // un superadmin no es: pedro sigue sin poder unirse directo
    expect((await joinPollaDirect(pedro, POLLA_1)).ok).toBe(false)
  })

  it('los pronósticos quedan aislados por polla', async () => {
    const db = await getDb()
    await db.query(
      `INSERT INTO matches (stage, kickoff_utc, status) VALUES ('GROUP', $1, 'SCHEDULED')`,
      [new Date(Date.now() + 60 * 60 * 1000).toISOString()]
    )
    const matchRows = await db.query<{ id: number }>('SELECT MAX(id) AS id FROM matches')
    const matchId = Number(matchRows[0].id)

    const cracks = (await listEntriesWithMembers(POLLA_1)).find((e) => e.name === 'Los Cracks')
    const jefa = (await listEntriesWithMembers(polla2Id)).find((e) => e.name === 'La Jefa')
    expect((await savePrediction(cracks!.id, matchId, 3, 1)).ok).toBe(true)
    expect((await savePrediction(jefa!.id, matchId, 0, 0)).ok).toBe(true)

    const inPolla1 = await getAllPredictions(POLLA_1)
    const inPolla2 = await getAllPredictions(polla2Id)
    expect(inPolla1.some((p) => p.entryId === cracks!.id)).toBe(true)
    expect(inPolla1.some((p) => p.entryId === jefa!.id)).toBe(false)
    expect(inPolla2.some((p) => p.entryId === jefa!.id)).toBe(true)

    // y dentro de la pareja sigue siendo un solo pronóstico compartido
    expect((await getEntryPredictions(cracks!.id)).get(matchId)).toMatchObject({
      homeGoals: 3,
      awayGoals: 1,
    })
  })

  it('nowIso produce timestamps ISO válidos para la capa de datos', () => {
    expect(Number.isNaN(Date.parse(nowIso()))).toBe(false)
  })

  it('los premios de jugador solo aceptan jugadores del catálogo', async () => {
    const db = await getDb()
    // un equipo con dos jugadores en el catálogo
    const teamRows = await db.query<{ id: number }>(
      `INSERT INTO teams (name, tla) VALUES ('Argentina', 'ARG') RETURNING id`
    )
    const teamId = teamRows[0].id
    const messiRows = await db.query<{ id: number }>(
      `INSERT INTO players (team_id, external_id, name, position) VALUES ($1, 'espn:t1', 'Lionel Messi', 'Forward') RETURNING id`,
      [teamId]
    )
    const messiId = messiRows[0].id
    await db.query(
      `INSERT INTO players (team_id, external_id, name, position) VALUES ($1, 'espn:t2', 'Julián Álvarez', 'Forward')`,
      [teamId]
    )

    const cracks = (await listEntriesWithMembers(POLLA_1)).find((e) => e.name === 'Los Cracks')

    // un id inexistente se rechaza (nada de texto libre)
    const bad = await saveAwardPick(cracks!.id, 'TOP_SCORER', { playerId: 99999 })
    expect(bad.ok).toBe(false)
    expect(bad.error).toMatch(/lista/i)

    // un jugador del catálogo se guarda con su nombre canónico
    const good = await saveAwardPick(cracks!.id, 'TOP_SCORER', { playerId: messiId })
    expect(good.ok).toBe(true)
    const pick = (await getEntryAwardPicks(cracks!.id)).get('TOP_SCORER')
    expect(pick?.playerId).toBe(messiId)
    expect(pick?.playerName).toBe('Lionel Messi')

    // el resultado oficial también se elige del catálogo y cruza por ID
    expect((await setAwardResult('TOP_SCORER', { playerId: 99999 })).ok).toBe(false)
    expect((await setAwardResult('TOP_SCORER', { playerId: messiId })).ok).toBe(true)
    const results = await getAwardResults()
    expect(isPickCorrect(pick!, results.get('TOP_SCORER'))).toBe(true)
  })

  it('un cruce de eliminatorias "por definir" se adopta sin duplicarse', async () => {
    const kickoff = '2026-07-04T19:00:00.000Z'
    const base: Omit<ProviderMatch, 'externalId' | 'homeTeam' | 'awayTeam'> = {
      stage: 'R16',
      groupName: null,
      matchday: null,
      kickoffUtc: kickoff,
      homeLabel: '1A',
      awayLabel: '2B',
      status: 'SCHEDULED',
      homeGoals: null,
      awayGoals: null,
      minute: null,
    }

    // el fixture siembra el cruce sin equipos (worldcup26)
    await applyProviderMatches('worldcup26', [
      { ...base, externalId: 'ko-1', homeTeam: null, awayTeam: null },
    ])

    // luego ESPN trae el MISMO partido ya con clasificados
    await applyProviderMatches('espn', [
      {
        ...base,
        externalId: '900',
        homeTeam: {
          externalId: '1',
          name: 'Brazil',
          shortName: null,
          tla: 'BRA',
          crestUrl: null,
          groupName: null,
        },
        awayTeam: {
          externalId: '2',
          name: 'Italy',
          shortName: null,
          tla: 'ITA',
          crestUrl: null,
          groupName: null,
        },
        homeGoals: null,
        awayGoals: null,
      },
    ])

    const db = await getDb()
    const rows = await db.query<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM matches WHERE stage = $1 AND kickoff_utc = $2',
      ['R16', kickoff]
    )
    expect(rows[0].n).toBe(1) // adoptó el cupo, no duplicó

    const filled = await db.query<{ home_team_id: number | null }>(
      'SELECT home_team_id FROM matches WHERE stage = $1 AND kickoff_utc = $2',
      ['R16', kickoff]
    )
    expect(filled[0].home_team_id).not.toBeNull() // y quedó con los clasificados
  })

  it('los pronósticos cierran 10 minutos antes del kickoff', async () => {
    const db = await getDb()
    // partido que arranca en 5 minutos: ya está dentro de la ventana de cierre
    await db.query(
      `INSERT INTO matches (stage, kickoff_utc, status) VALUES ('GROUP', $1, 'SCHEDULED')`,
      [new Date(Date.now() + 5 * 60_000).toISOString()]
    )
    const rows = await db.query<{ id: number }>('SELECT MAX(id) AS id FROM matches')
    const soonMatchId = Number(rows[0].id)

    const cracks = (await listEntriesWithMembers(POLLA_1)).find((e) => e.name === 'Los Cracks')
    const result = await savePrediction(cracks!.id, soonMatchId, 1, 0)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/10 minutos/i)
  })
})
