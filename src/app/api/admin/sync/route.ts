import { NextResponse } from 'next/server'
import { getSession } from '@/features/auth/session'
import { syncNow } from '@/features/livescore/sync'

// El fixture es compartido por todas las pollas: lo administra el superadmin
export async function POST() {
  const user = await getSession()
  if (!user?.isSuperadmin) {
    return NextResponse.json({ ok: false, error: 'Solo el superadmin' }, { status: 403 })
  }
  const result = await syncNow()
  return NextResponse.json(result, { status: result.ok ? 200 : 502 })
}
