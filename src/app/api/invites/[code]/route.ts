import { NextResponse } from 'next/server'
import { getInviteStatus } from '@/features/invites/service'

// Info pública de una invitación: el formulario de registro la usa para saber
// si pedir nombre de pareja. No expone nada sensible.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const status = await getInviteStatus(code)
  if (!status || status.revoked || status.slotsLeft === 0) {
    return NextResponse.json({ ok: false, error: 'Invitación inválida o ya usada' }, { status: 404 })
  }
  return NextResponse.json({
    ok: true,
    kind: status.kind,
    label: status.label,
    slotsLeft: status.slotsLeft,
    entryName: status.entryName,
    /** true cuando te unes a una pareja que ya tiene su primer integrante */
    joiningExisting: status.entryId !== null && status.usedBy.length > 0,
  })
}
