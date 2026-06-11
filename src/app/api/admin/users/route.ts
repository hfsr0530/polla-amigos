import { NextResponse } from 'next/server'
import { getSession } from '@/features/auth/session'
import { deleteUser } from '@/features/auth/service'

interface Body {
  action?: 'delete'
  userId?: number
}

// Eliminar cuentas es exclusivo del superadmin (no a sí mismo ni a otro superadmin).
export async function POST(request: Request) {
  const user = await getSession()
  if (!user?.isSuperadmin) {
    return NextResponse.json({ ok: false, error: 'Solo el superadmin' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as Body
  if (body.action !== 'delete') {
    return NextResponse.json({ ok: false, error: 'Acción desconocida' }, { status: 400 })
  }
  const userId = Number(body.userId)
  if (!Number.isInteger(userId)) {
    return NextResponse.json({ ok: false, error: 'Usuario inválido' }, { status: 400 })
  }

  const result = await deleteUser(userId, user.id)
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
