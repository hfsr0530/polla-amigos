import { NextResponse } from 'next/server'
import { getSession } from '@/features/auth/session'
import { createPolla, deletePolla } from '@/features/pollas/service'
import { createInvite } from '@/features/invites/service'

interface Body {
  action?: 'create' | 'delete'
  name?: string
  pollaId?: number
}

// Crear y eliminar pollas es exclusivo del superadmin.
export async function POST(request: Request) {
  const user = await getSession()
  if (!user?.isSuperadmin) {
    return NextResponse.json({ ok: false, error: 'Solo el superadmin' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as Body

  if (body.action === 'delete') {
    const pollaId = Number(body.pollaId)
    if (!Number.isInteger(pollaId)) {
      return NextResponse.json({ ok: false, error: 'Polla inválida' }, { status: 400 })
    }
    const result = await deletePolla(pollaId)
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  }

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
