import { redirect } from 'next/navigation'
import { getSession } from '@/features/auth/session'
import { registrationNeedsInvite } from '@/features/auth/service'
import { getT } from '@/shared/i18n/server'
import { AuthCard } from '@/features/auth/components/AuthCard'
import { LangToggle } from '@/shared/components/LangToggle'

export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>
}) {
  const user = await getSession()
  if (user) redirect('/partidos')

  const params = await searchParams
  const [needsInvite, t] = await Promise.all([registrationNeedsInvite(), getT()])

  return (
    <div className="relative flex min-h-[80dvh] flex-col items-center justify-center gap-8">
      <div className="absolute right-0 top-2">
        <LangToggle />
      </div>
      <header className="text-center">
        <p className="text-5xl" aria-hidden>
          ⚽
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
          Polla <span className="text-emerald-400">Amigos</span>
        </h1>
        <p className="mt-2 text-sm text-slate-400">{t('login.tagline')}</p>
      </header>
      <AuthCard
        needsInvite={needsInvite}
        initialCode={params.codigo}
        defaultMode={params.codigo || !needsInvite ? 'register' : 'login'}
      />
    </div>
  )
}
