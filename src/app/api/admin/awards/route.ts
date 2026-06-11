import { NextResponse } from 'next/server'
import { getSession } from '@/features/auth/session'
import { setAwardResult, setPickCorrectOverride } from '@/features/awards/service'
import { getEntry } from '@/features/entries/service'
import type { AwardKey } from '@/shared/types/domain'
import { PLAYER_AWARDS, TEAM_AWARDS } from '@/shared/types/domain'

interface Body {
  action?: 'result' | 'override'
  award?: AwardKey
  teamId?: number | null
  playerId?: number | null
  entryId?: number
  correct?: boolean | null
}

function isAward(value: unknown): value is AwardKey {
  return (
    typeof value === 'string' &&
    ([...TEAM_AWARDS, ...PLAYER_AWARDS] as string[]).includes(value)
  )
}

export async function POST(request: Request) {
  const user = await getSession()
  if (!user || (!user.isPollaAdmin && !user.isSuperadmin)) {
    return NextResponse.json({ ok: false, error: 'Solo administradores' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as Body
  if (!isAward(body.award)) {
    return NextResponse.json({ ok: false, error: 'Premio inválido' }, { status: 400 })
  }

  if (body.action === 'override') {
    // Validar aciertos de picks: el admin de la polla del pick (o superadmin)
    const entryId = Number(body.entryId)
    if (!Number.isInteger(entryId)) {
      return NextResponse.json({ ok: false, error: 'Participante inválido' }, { status: 400 })
    }
    const entry = await getEntry(entryId)
    if (!entry) {
      return NextResponse.json({ ok: false, error: 'Participante inexistente' }, { status: 400 })
    }
    if (!user.isSuperadmin && !(user.isPollaAdmin && entry.pollaId === user.pollaId)) {
      return NextResponse.json({ ok: false, error: 'Participante de otra polla' }, { status: 403 })
    }
    await setPickCorrectOverride(entryId, body.award, body.correct ?? null)
    return NextResponse.json({ ok: true })
  }

  // Ganadores oficiales del torneo: afectan a todas las pollas → superadmin
  if (!user.isSuperadmin) {
    return NextResponse.json({ ok: false, error: 'Solo el superadmin' }, { status: 403 })
  }
  const result = await setAwardResult(body.award, {
    teamId: body.teamId !== undefined && body.teamId !== null ? Number(body.teamId) : null,
    playerId:
      body.playerId !== undefined && body.playerId !== null ? Number(body.playerId) : null,
  })
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
