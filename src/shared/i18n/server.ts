import 'server-only'
import { cookies } from 'next/headers'
import { makeT, type Lang, type TFunc } from './dictionary'

export const LANG_COOKIE = 'polla_lang'

export async function getLang(): Promise<Lang> {
  const cookieStore = await cookies()
  return cookieStore.get(LANG_COOKIE)?.value === 'en' ? 'en' : 'es'
}

export async function getT(): Promise<TFunc> {
  return makeT(await getLang())
}
