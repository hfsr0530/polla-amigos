'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApiError, useT } from '@/shared/i18n/I18nProvider'

interface JoinInviteCardProps {
  code: string
  isPair: boolean
  joiningExisting: boolean
  displayName: string
}

// Un usuario YA logueado acepta una invitación a otra polla con su cuenta
export function JoinInviteCard({ code, isPair, joiningExisting, displayName }: JoinInviteCardProps) {
  const router = useRouter()
  const t = useT()
  const apiError = useApiError()
  const [pairName, setPairName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function join() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join-code', code, pairName: pairName.trim() || undefined }),
      })
      const data = (await res.json()) as { ok: boolean; error?: string }
      if (!data.ok) {
        setError(data.error ? apiError(data.error) : t('invite.joinError'))
        return
      }
      router.push('/partidos')
      router.refresh()
    } catch {
      setError(t('score.noConnection'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center shadow-xl">
      <p className="text-sm text-slate-300">
        {t('invite.joinAs', { name: displayName })}
      </p>

      {isPair && !joiningExisting && (
        <label className="mt-4 flex flex-col gap-1 text-left text-sm">
          <span className="text-slate-300">
            {t('login.pairName')} <span className="text-slate-500">{t('login.optional')}</span>
          </span>
          <input
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            value={pairName}
            maxLength={40}
            placeholder={t('login.pairNamePlaceholder')}
            onChange={(e) => setPairName(e.target.value)}
          />
        </label>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={join}
        className="mt-4 w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-60"
      >
        {busy ? t('invite.joining') : t('invite.joinCta')}
      </button>
    </section>
  )
}
