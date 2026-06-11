import { NextResponse } from 'next/server'
import { getSession } from '@/features/auth/session'
import { createPolla } from '@/features/pollas/service'
import { createInvite } from '@/features/invites/service'

interface Body {
  name?: string
}

// Crear pollas es exclusivo del superadmin: genera la polla y un código de
// administrador para entregársela a quien la va a manejar.
export async function POST(request: Request) {
  const user = await getSession()
  if (!user?.isSuperadmin) {
    return NextResponse.json({ ok: false, error: 'Solo el superadmin' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as Body
  const name = (body.name ?? '').trim()
  if (name.length < 3 || name.length > 60) {
    return NextResponse.json(
      { ok: false, error: 'El nombre debe tener entre 3 y 60 caracteres' },
      { status: 400 }
    )
  }

  const polla = await createPolla(name)
  const adminInvite = await createInvite(polla.id, 'INDIVIDUAL', {
    label: `Admin de ${name}`,
    grantsAdmin: true,
  })

  return NextResponse.json({ ok: true, pollaId: polla.id, adminCode: adminInvite.code })
}
