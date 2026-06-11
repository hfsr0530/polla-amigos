'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/shared/i18n/I18nProvider'

interface SyncPanelProps {
  provider: string
  lastSyncAt: string | null
  lastSyncCount: string | null
  lastError: string | null
  playersCount: number
}

export function SyncPanel({
  provider,
  lastSyncAt,
  lastSyncCount,
  lastError,
  playersCount,
}: SyncPanelProps) {
  const router = useRouter()
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSquads() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/squads', { method: 'POST' })
      const data = (await res.json()) as { ok: boolean; players?: number; error?: string }
      setMessage(
        data.ok
          ? t('admin.sync.squadsOk', { n: data.players ?? 0 })
          : t('admin.sync.error', { msg: data.error ?? t('admin.sync.unknown') })
      )
      router.refresh()
    } catch {
      setMessage(t('admin.sync.connError'))
    } finally {
      setBusy(false)
    }
  }

  async function handleSync() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/sync', { method: 'POST' })
      const data = (await res.json()) as { ok: boolean; matches?: number; error?: string }
      setMessage(
        data.ok
          ? t('admin.sync.ok', { n: data.matches ?? 0 })
          : t('admin.sync.error', { msg: data.error ?? t('admin.sync.unknown') })
      )
      router.refresh()
    } catch {
      setMessage(t('admin.sync.connError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            {t('admin.sync.provider')}
          </dt>
          <dd className="font-semibold">{provider}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">{t('admin.sync.last')}</dt>
          <dd className="font-semibold tabular-nums">
            {lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : t('admin.sync.never')}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            {t('admin.sync.matches')}
          </dt>
          <dd className="font-semibold tabular-nums">{lastSyncCount ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            {t('admin.sync.players')}
          </dt>
          <dd className="font-semibold tabular-nums">{playersCount}</dd>
        </div>
      </dl>

      <div className="flex flex-col items-start gap-1.5 sm:items-end">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSquads}
            disabled={busy}
            className="rounded-xl border border-emerald-500/50 px-4 py-2 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/10 disabled:opacity-60"
          >
            {busy ? t('admin.sync.syncing') : t('admin.sync.squadsButton')}
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={busy}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-60"
          >
            {busy ? t('admin.sync.syncing') : t('admin.sync.button')}
          </button>
        </div>
        {message && <p className="text-xs text-slate-300">{message}</p>}
        {lastError && !message && (
          <p className="max-w-xs text-right text-xs text-red-400">
            {t('admin.sync.lastError', { msg: lastError })}
          </p>
        )}
      </div>
    </div>
  )
}
