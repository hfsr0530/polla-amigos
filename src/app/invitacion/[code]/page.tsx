import Link from 'next/link'
import { getSession } from '@/features/auth/session'
import { getUserMemberships } from '@/features/auth/service'
import { getInviteStatus } from '@/features/invites/service'
import { AuthCard } from '@/features/auth/components/AuthCard'
import { JoinInviteCard } from '@/features/invites/components/JoinInviteCard'
import { LangToggle } from '@/shared/components/LangToggle'
import { getT } from '@/shared/i18n/server'

export const dynamic = 'force-dynamic'

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const user = await getSession()
  const { code } = await params
  const [t, invite] = await Promise.all([getT(), getInviteStatus(code)])
  const valid = invite && !invite.revoked && invite.slotsLeft > 0

  if (!valid) {
    return (
      <div className="relative flex min-h-[80dvh] flex-col items-center justify-center gap-6 text-center">
        {!user && (
          <div className="absolute right-0 top-2">
            <LangToggle />
          </div>
        )}
        <p className="text-5xl" aria-hidden>
          🎫
        </p>
        <div>
          <h1 className="text-2xl font-extrabold">{t('invite.invalid.title')}</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">{t('invite.invalid.body')}</p>
        </div>
        <Link
          href={user ? '/partidos' : '/login'}
          className="text-sm font-semibold text-emerald-400 hover:underline"
        >
          {user ? t('invite.invalid.toMatches') : t('invite.invalid.toLogin')}
        </Link>
      </div>
    )
  }

  const isPair = invite.kind === 'PAIR'
  const joining = invite.entryId !== null && invite.usedBy.length > 0
  const alreadyInPolla = user
    ? (await getUserMemberships(user.id)).some((m) => m.pollaId === invite.pollaId)
    : false

  const adminNoteParts = t('invite.adminNote').split('{b}')

  return (
    <div className="relative flex min-h-[80dvh] flex-col items-center justify-center gap-8">
      {!user && (
        <div className="absolute right-0 top-2">
          <LangToggle />
        </div>
      )}
      <header className="text-center">
        <p className="text-5xl" aria-hidden>
          {invite.grantsAdmin ? '👑' : isPair ? '👥' : '🎟️'}
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
          {t('invite.title', {
            polla: invite.pollaName ? `«${invite.pollaName}»` : t('invite.fallbackPolla'),
          })}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
          {invite.grantsAdmin ? (
            <>
              {adminNoteParts[0]}
              <strong className="text-slate-200">{t('invite.adminNoteBold')}</strong>
              {adminNoteParts[1]}
            </>
          ) : joining && invite.entryName ? (
            t('invite.joiningNote', { name: invite.entryName })
          ) : isPair ? (
            t('invite.pairNote')
          ) : (
            t('invite.individualNote')
          )}
          {invite.label && <span className="mt-1 block text-slate-500">({invite.label})</span>}
        </p>
      </header>

      {user ? (
        alreadyInPolla ? (
          <section className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center">
            <p className="text-sm text-slate-300">
              {t('invite.alreadyIn', { name: invite.pollaName ?? '' })}
            </p>
            <Link
              href="/partidos"
              className="mt-3 inline-block text-sm font-semibold text-emerald-400 hover:underline"
            >
              {t('invite.goMatches')}
            </Link>
          </section>
        ) : (
          <JoinInviteCard
            code={invite.code}
            isPair={isPair}
            joiningExisting={joining}
            displayName={user.displayName}
          />
        )
      ) : (
        <AuthCard needsInvite initialCode={invite.code} defaultMode="register" />
      )}
    </div>
  )
}
