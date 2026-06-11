import { NextResponse } from 'next/server'
import { registerUser } from '@/features/auth/service'
import { createSession } from '@/features/auth/session'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    username?: string
    displayName?: string
    pin?: string
    inviteCode?: string
    pairName?: string
  }
  const result = await registerUser({
    username: String(body.username ?? ''),
    displayName: String(body.displayName ?? ''),
    pin: String(body.pin ?? ''),
    inviteCode: body.inviteCode ? String(body.inviteCode) : undefined,
    pairName: body.pairName ? String(body.pairName) : undefined,
  })
  if (!result.ok || !result.user) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  }
  await createSession(result.user)
  return NextResponse.json({ ok: true })
}
