import { NextResponse } from 'next/server'
import { getSession } from '@/features/auth/session'
import { saveAwardPick } from '@/features/awards/service'
import type { AwardKey } from '@/shared/types/domain'

export async function POST(request: Request) {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Inicia sesión de nuevo' }, { status: 401 })
  }
  const body = (await request.json().catch(() => ({}))) as {
    award?: AwardKey
    teamId?: number
    playerId?: number
  }
  if (!body.award) {
    return NextResponse.json({ ok: false, error: 'Premio inválido' }, { status: 400 })
  }
  const result = await saveAwardPick(user.entryId, body.award, {
    teamId: body.teamId !== undefined ? Number(body.teamId) : undefined,
    playerId: body.playerId !== undefined ? Number(body.playerId) : undefined,
  })
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
