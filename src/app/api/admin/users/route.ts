import { NextResponse } from 'next/server'
import { getSession } from '@/features/auth/session'
import { deleteUser, resetUserPin } from '@/features/auth/service'

interface Body {
  action?: 'delete' | 'reset-pin'
  userId?: number
  newPin?: string
}

// Eliminar cuentas y resetear PINs es exclusivo del superadmin.
export async function POST(request: Request) {
  const user = await getSession()
  if (!user?.isSuperadmin) {
    return NextResponse.json({ ok: false, error: 'Solo el superadmin' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as Body
  const userId = Number(body.userId)
  if (!Number.isInteger(userId)) {
    return NextResponse.json({ ok: false, error: 'Usuario inválido' }, { status: 400 })
  }

  if (body.action === 'reset-pin') {
    const result = await resetUserPin(userId, String(body.newPin ?? ''))
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  }

  if (body.action === 'delete') {
    const result = await deleteUser(userId, user.id)
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  }

  return NextResponse.json({ ok: false, error: 'Acción desconocida' }, { status: 400 })
}
