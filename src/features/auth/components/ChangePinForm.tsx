'use client'

import { useState } from 'react'
import { useApiError, useT } from '@/shared/i18n/I18nProvider'

// Cada usuario cambia su propio PIN desde su página (verifica el actual)
export function ChangePinForm() {
  const t = useT()
  const apiError = useApiError()
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit() {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/auth/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin: current, newPin: next }),
      })
      const data = (await res.json()) as { ok: boolean; error?: string }
      if (!data.ok) {
        setMsg({ ok: false, text: data.error ? apiError(data.error) : t('score.saveError') })
        return
      }
      setMsg({ ok: true, text: t('entry.pinChanged') })
      setCurrent('')
      setNext('')
      setOpen(false)
    } catch {
      setMsg({ ok: false, text: t('score.noConnection') })
    } finally {
      setBusy(false)
    }
  }

  const pinInput =
    'h-7 w-28 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-white focus:border-emerald-500 focus:outline-none'

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(true)
            setMsg(null)
          }}
          className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-sky-300 transition-colors hover:bg-slate-700"
        >
          {t('entry.changePin')}
        </button>
        {msg?.ok && <span className="text-xs text-emerald-400">{msg.text}</span>}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        value={current}
        maxLength={6}
        placeholder={t('entry.currentPin')}
        onChange={(e) => setCurrent(e.target.value.replace(/\D/g, '').slice(0, 6))}
        className={pinInput}
      />
      <input
        type="password"
        inputMode="numeric"
        autoComplete="new-password"
        value={next}
        maxLength={6}
        placeholder={t('entry.newPin')}
        onChange={(e) => setNext(e.target.value.replace(/\D/g, '').slice(0, 6))}
        className={pinInput}
      />
      <button
        type="button"
        disabled={busy || current.length < 4 || next.length < 4}
        onClick={submit}
        className="rounded-md bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
      >
        {t('score.save')}
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false)
          setCurrent('')
          setNext('')
        }}
        className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:text-white"
      >
        {t('admin.people.cancel')}
      </button>
      {msg && !msg.ok && (
        <span role="alert" className="text-xs text-red-400">
          {msg.text}
        </span>
      )}
    </div>
  )
}
