import { NextResponse } from 'next/server'
import { getSession } from '@/features/auth/session'
import { savePrediction } from '@/features/predictions/service'

export async function POST(request: Request) {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Inicia sesión de nuevo' }, { status: 401 })
  }
  const body = (await request.json().catch(() => ({}))) as {
    matchId?: number
    homeGoals?: number
    awayGoals?: number
  }
  const result = await savePrediction(
    user.entryId,
    Number(body.matchId),
    Number(body.homeGoals),
    Number(body.awayGoals)
  )
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
