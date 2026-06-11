import { redirect } from 'next/navigation'
import { getSession } from '@/features/auth/session'

export default async function HomePage() {
  const user = await getSession()
  redirect(user ? '/partidos' : '/login')
}
