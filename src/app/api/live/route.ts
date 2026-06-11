import { NextResponse } from 'next/server'
import { maybeSync } from '@/features/livescore/sync'

// La UI lo llama cada minuto: el sync real está throttled en el servidor,
// así que da igual cuántos navegadores estén abiertos.
export async function GET() {
  const result = await maybeSync()
  return NextResponse.json({ ok: true, synced: result?.ok ?? false })
}
