import { NextResponse } from 'next/server'
import { loginUser } from '@/features/auth/service'
import { createSession } from '@/features/auth/session'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { username?: string; pin?: string }
  const result = await loginUser(String(body.username ?? ''), String(body.pin ?? ''))
  if (!result.ok || !result.user) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 401 })
  }
  await createSession(result.user)
  return NextResponse.json({ ok: true })
}
