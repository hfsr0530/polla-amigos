import 'server-only'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import type { SessionUser } from '@/shared/types/domain'

const COOKIE_NAME = 'polla_session'
const SESSION_DAYS = 90

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET ?? 'polla-dev-secret-cambialo-en-produccion'
  return new TextEncoder().encode(secret)
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({
    name: user.displayName,
    username: user.username,
    entryId: user.entryId,
    pollaId: user.pollaId,
    pollaAdmin: user.isPollaAdmin,
    superadmin: user.isSuperadmin,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret())

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    // La polla suele servirse por HTTP plano (IP local o túnel): el flag Secure
    // rompería la sesión ahí. Actívalo con COOKIE_SECURE=true si tienes HTTPS.
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: '/',
  })
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecret())
    const entryId = Number(payload.entryId ?? 0)
    const pollaId = Number(payload.pollaId ?? 0)
    // Sesiones de modelos anteriores (sin entry o sin polla) se invalidan
    // para forzar un login limpio
    if (!Number.isInteger(entryId) || entryId <= 0) return null
    if (!Number.isInteger(pollaId) || pollaId <= 0) return null
    return {
      id: Number(payload.sub),
      username: String(payload.username ?? ''),
      displayName: String(payload.name ?? ''),
      entryId,
      pollaId,
      isPollaAdmin: payload.pollaAdmin === true,
      isSuperadmin: payload.superadmin === true,
    }
  } catch {
    return null
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
