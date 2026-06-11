import { NextResponse } from 'next/server'
import { getSession } from '@/features/auth/session'
import { setAwardsOpen } from '@/features/pollas/service'

// Habilitar/cerrar la edición de premios de la polla activa.
// Lo controla el admin de la polla o el superadmin.
export async function POST(request: Request) {
  const user = await getSession()
  if (!user || (!user.isPollaAdmin && !user.isSuperadmin)) {
    return NextResponse.json({ ok: false, error: 'Solo el admin de la polla' }, { status: 403 })
  }
  const body = (await request.json().catch(() => ({}))) as { open?: boolean }
  await setAwardsOpen(user.pollaId, body.open === true)
  return NextResponse.json({ ok: true })
}
