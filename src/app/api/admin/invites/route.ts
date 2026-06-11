import { NextResponse } from 'next/server'
import { getSession } from '@/features/auth/session'
import { createInvite, revokeInvite, getInvite } from '@/features/invites/service'
import { getEntry, countEntryMembers } from '@/features/entries/service'

interface Body {
  action?: 'create' | 'revoke'
  kind?: 'INDIVIDUAL' | 'PAIR'
  label?: string
  /** true → invitación para unirse a la entrada del propio admin (su pareja) */
  joinMyEntry?: boolean
  code?: string
}

// Las invitaciones las maneja el admin de cada polla (o el superadmin) y
// siempre quedan atadas a la polla de quien las crea.
export async function POST(request: Request) {
  const user = await getSession()
  if (!user || (!user.isPollaAdmin && !user.isSuperadmin)) {
    return NextResponse.json({ ok: false, error: 'Solo el admin de la polla' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as Body

  if (body.action === 'revoke') {
    if (!body.code) {
      return NextResponse.json({ ok: false, error: 'Falta el código' }, { status: 400 })
    }
    const invite = await getInvite(body.code)
    if (!invite || (invite.pollaId !== user.pollaId && !user.isSuperadmin)) {
      return NextResponse.json({ ok: false, error: 'Invitación de otra polla' }, { status: 403 })
    }
    await revokeInvite(body.code)
    return NextResponse.json({ ok: true })
  }

  if (body.joinMyEntry) {
    // Convierte la entrada del admin en pareja cuando alguien use el código
    const entry = await getEntry(user.entryId)
    if (!entry) {
      return NextResponse.json({ ok: false, error: 'Tu entrada no existe' }, { status: 400 })
    }
    if ((await countEntryMembers(entry.id)) >= 2) {
      return NextResponse.json({ ok: false, error: 'Tu pareja ya está completa' }, { status: 400 })
    }
    const invite = await createInvite(user.pollaId, 'PAIR', {
      label: body.label ?? 'Mi pareja',
      targetEntryId: entry.id,
    })
    return NextResponse.json({ ok: true, code: invite.code })
  }

  const kind = body.kind === 'PAIR' ? 'PAIR' : 'INDIVIDUAL'
  const invite = await createInvite(user.pollaId, kind, { label: body.label ?? null })
  return NextResponse.json({ ok: true, code: invite.code })
}
