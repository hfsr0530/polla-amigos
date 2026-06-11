'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApiError, useT } from '@/shared/i18n/I18nProvider'

interface ManualResultFormProps {
  matchId: number
  homeName: string
  awayName: string
  homeGoals: number | null
  awayGoals: number | null
  status: string
  locked: boolean
}

export function ManualResultForm({
  matchId,
  homeName,
  awayName,
  homeGoals,
  awayGoals,
  status,
  locked,
}: ManualResultFormProps) {
  const router = useRouter()
  const t = useT()
  const apiError = useApiError()
  const [home, setHome] = useState(homeGoals === null ? '' : String(homeGoals))
  const [away, setAway] = useState(awayGoals === null ? '' : String(awayGoals))
  const [final, setFinal] = useState(status !== 'LIVE')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function post(body: Record<string, unknown>) {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as { ok: boolean; error?: string }
      setMessage(data.ok ? '✓' : data.error ? apiError(data.error) : 'Error')
      router.refresh()
    } catch {
      setMessage(t('score.noConnection'))
    } finally {
      setBusy(false)
    }
  }

  const inputClasses =
    'h-8 w-10 rounded-md border border-slate-700 bg-slate-950 text-center text-sm font-bold text-white focus:border-amber-500 focus:outline-none'

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="min-w-0 flex-1 truncate">
        {homeName} <span className="text-slate-500">vs</span> {awayName}
        {locked && (
          <span className="ml-1.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-300">
            {t('admin.results.manual')}
          </span>
        )}
      </span>
      <div className="flex items-center gap-1.5">
        <input
          aria-label={t('admin.results.homeGoals', { name: homeName })}
          inputMode="numeric"
          value={home}
          onChange={(e) => setHome(e.target.value.replace(/\D/g, '').slice(0, 2))}
          className={inputClasses}
        />
        <span className="text-slate-500">:</span>
        <input
          aria-label={t('admin.results.homeGoals', { name: awayName })}
          inputMode="numeric"
          value={away}
          onChange={(e) => setAway(e.target.value.replace(/\D/g, '').slice(0, 2))}
          className={inputClasses}
        />
        <label className="ml-1 flex items-center gap-1 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={final}
            onChange={(e) => setFinal(e.target.checked)}
            className="accent-emerald-500"
          />
          {t('admin.results.final')}
        </label>
        <button
          type="button"
          disabled={busy || home === '' || away === ''}
          onClick={() =>
            post({
              action: 'set',
              matchId,
              homeGoals: Number(home),
              awayGoals: Number(away),
              status: final ? 'FINISHED' : 'LIVE',
            })
          }
          className="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
        >
          {t('admin.results.set')}
        </button>
        {locked && (
          <button
            type="button"
            disabled={busy}
            onClick={() => post({ action: 'unlock', matchId })}
            className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-300 transition-colors hover:border-slate-400"
            title={t('admin.results.releaseTitle')}
          >
            {t('admin.results.release')}
          </button>
        )}
        {message && <span className="text-xs text-slate-400">{message}</span>}
      </div>
    </div>
  )
}
