import { NextResponse } from 'next/server'
import { getSession } from '@/features/auth/session'
import { isEntryMember, renameEntry } from '@/features/entries/service'

interface Body {
  action?: 'rename'
  entryId?: number
  name?: string
}

// Renombrar una entrada: el superadmin cualquiera, o un miembro la suya
// (p. ej. el nombre de su pareja).
export async function POST(request: Request) {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Inicia sesión de nuevo' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as Body
  if (body.action !== 'rename') {
    return NextResponse.json({ ok: false, error: 'Acción desconocida' }, { status: 400 })
  }
  const entryId = Number(body.entryId)
  if (!Number.isInteger(entryId)) {
    return NextResponse.json({ ok: false, error: 'Entrada inválida' }, { status: 400 })
  }

  if (!user.isSuperadmin && !(await isEntryMember(user.id, entryId))) {
    return NextResponse.json({ ok: false, error: 'No es tu entrada' }, { status: 403 })
  }

  const result = await renameEntry(entryId, String(body.name ?? ''))
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
