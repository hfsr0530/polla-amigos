import { NextResponse } from 'next/server'
import { getSession } from '@/features/auth/session'
import { syncSquads } from '@/features/players/service'

// Re-descarga las plantillas de las 48 selecciones desde ESPN
export async function POST() {
  const user = await getSession()
  if (!user?.isSuperadmin) {
    return NextResponse.json({ ok: false, error: 'Solo el superadmin' }, { status: 403 })
  }
  const result = await syncSquads()
  return NextResponse.json(result, { status: result.ok ? 200 : 502 })
}
