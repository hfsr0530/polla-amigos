import { NextResponse } from 'next/server'
import { getSession } from '@/features/auth/session'
import { getMatchById, setManualResult, unlockResult } from '@/features/matches/service'

interface Body {
  action?: 'set' | 'unlock'
  matchId?: number
  homeGoals?: number
  awayGoals?: number
  status?: 'LIVE' | 'FINISHED'
}

// Los resultados de partidos afectan a todas las pollas: solo superadmin
export async function POST(request: Request) {
  const user = await getSession()
  if (!user?.isSuperadmin) {
    return NextResponse.json({ ok: false, error: 'Solo el superadmin' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as Body
  const matchId = Number(body.matchId)
  if (!Number.isInteger(matchId) || !(await getMatchById(matchId))) {
    return NextResponse.json({ ok: false, error: 'Partido inválido' }, { status: 400 })
  }

  if (body.action === 'unlock') {
    await unlockResult(matchId)
    return NextResponse.json({ ok: true })
  }

  const home = Number(body.homeGoals)
  const away = Number(body.awayGoals)
  const status = body.status === 'LIVE' ? 'LIVE' : 'FINISHED'
  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0 || home > 99 || away > 99) {
    return NextResponse.json({ ok: false, error: 'Marcador inválido' }, { status: 400 })
  }

  await setManualResult(matchId, home, away, status)
  return NextResponse.json({ ok: true })
}
