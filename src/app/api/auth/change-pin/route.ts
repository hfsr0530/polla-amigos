import { NextResponse } from 'next/server'
import { getSession } from '@/features/auth/session'
import { changeMyPin } from '@/features/auth/service'

export async function POST(request: Request) {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Inicia sesión de nuevo' }, { status: 401 })
  }
  const body = (await request.json().catch(() => ({}))) as {
    currentPin?: string
    newPin?: string
  }
  const result = await changeMyPin(user.id, String(body.currentPin ?? ''), String(body.newPin ?? ''))
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
