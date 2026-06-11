'use client'

import { useState } from 'react'
import { useApiError, useT } from '@/shared/i18n/I18nProvider'

interface ScoreInputProps {
  matchId: number
  initialHome: number | null
  initialAway: number | null
  disabled?: boolean
}

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export function ScoreInput({ matchId, initialHome, initialAway, disabled }: ScoreInputProps) {
  const t = useT()
  const apiError = useApiError()
  const [home, setHome] = useState(initialHome === null ? '' : String(initialHome))
  const [away, setAway] = useState(initialAway === null ? '' : String(initialAway))
  const [state, setState] = useState<SaveState>('idle')
  const [error, setError] = useState<string | null>(null)

  function sanitize(value: string): string {
    return value.replace(/\D/g, '').slice(0, 2)
  }

  async function save() {
    if (home === '' || away === '') {
      setError(t('score.completeBoth'))
      setState('error')
      return
    }
    setState('saving')
    setError(null)
    try {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, homeGoals: Number(home), awayGoals: Number(away) }),
      })
      const data = (await res.json()) as { ok: boolean; error?: string }
      if (!data.ok) {
        setError(data.error ? apiError(data.error) : t('score.saveError'))
        setState('error')
        return
      }
      setState('saved')
    } catch {
      setError(t('score.noConnection'))
      setState('error')
    }
  }

  const inputClasses =
    'h-10 w-12 rounded-lg border border-slate-700 bg-slate-950 text-center text-base font-bold text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-colors disabled:opacity-40'

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1.5">
        <label className="sr-only" htmlFor={`pred-home-${matchId}`}>
          {t('score.homeGoals')}
        </label>
        <input
          id={`pred-home-${matchId}`}
          inputMode="numeric"
          value={home}
          disabled={disabled || state === 'saving'}
          onChange={(e) => {
            setHome(sanitize(e.target.value))
            setState('dirty')
          }}
          className={inputClasses}
          placeholder="–"
        />
        <span className="text-slate-500">:</span>
        <label className="sr-only" htmlFor={`pred-away-${matchId}`}>
          {t('score.awayGoals')}
        </label>
        <input
          id={`pred-away-${matchId}`}
          inputMode="numeric"
          value={away}
          disabled={disabled || state === 'saving'}
          onChange={(e) => {
            setAway(sanitize(e.target.value))
            setState('dirty')
          }}
          className={inputClasses}
          placeholder="–"
        />
      </div>

      {!disabled && (state === 'dirty' || state === 'saving' || state === 'error') && (
        <button
          type="button"
          onClick={save}
          disabled={state === 'saving'}
          className="rounded-md bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-60"
        >
          {state === 'saving' ? t('score.saving') : t('score.save')}
        </button>
      )}
      {state === 'saved' && <span className="text-xs text-emerald-400">{t('score.saved')}</span>}
      {state === 'error' && error && (
        <span role="alert" className="max-w-[9rem] text-center text-xs text-red-400">
          {error}
        </span>
      )}
    </div>
  )
}
