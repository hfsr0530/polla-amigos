import { NextResponse } from 'next/server'
import { getSession, createSession } from '@/features/auth/session'
import { joinPollaDirect, joinWithInvite, switchActiveEntry } from '@/features/auth/service'

interface Body {
  action?: 'join-code' | 'join-polla' | 'switch'
  code?: string
  pairName?: string
  pollaId?: number
  entryId?: number
}

// Une la cuenta actual a otra polla o cambia la polla activa.
// Siempre re-emite la sesión con la entrada activa nueva.
export async function POST(request: Request) {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Inicia sesión de nuevo' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as Body

  let result
  switch (body.action) {
    case 'join-code':
      if (!body.code) {
        return NextResponse.json({ ok: false, error: 'Falta el código' }, { status: 400 })
      }
      result = await joinWithInvite(user.id, String(body.code), body.pairName ?? '')
      break
    case 'join-polla': {
      if (!user.isSuperadmin) {
        return NextResponse.json({ ok: false, error: 'Solo el superadmin' }, { status: 403 })
      }
      result = await joinPollaDirect(user.id, Number(body.pollaId))
      break
    }
    case 'switch':
      result = await switchActiveEntry(user.id, Number(body.entryId))
      break
    default:
      return NextResponse.json({ ok: false, error: 'Acción desconocida' }, { status: 400 })
  }

  if (!result.ok || !result.user) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  }
  await createSession(result.user)
  return NextResponse.json({ ok: true, pollaId: result.user.pollaId })
}
