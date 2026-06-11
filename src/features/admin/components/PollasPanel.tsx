'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useApiError, useT } from '@/shared/i18n/I18nProvider'

export interface PollaView {
  id: number
  name: string
  adminName: string | null
  entryCount: number
  userCount: number
  pendingAdminCode: string | null
}

interface PollasPanelProps {
  pollas: PollaView[]
  currentPollaId: number
  /** Pollas donde el superadmin ya participa (para ofrecer «Unirme» en el resto) */
  myPollaIds: number[]
}

export function PollasPanel({ pollas, currentPollaId, myPollaIds }: PollasPanelProps) {
  const router = useRouter()
  const t = useT()
  const apiError = useApiError()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  async function createPolla() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/pollas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = (await res.json()) as { ok: boolean; adminCode?: string; error?: string }
      if (!data.ok) {
        setMessage(data.error ? apiError(data.error) : t('admin.pollas.createError'))
        return
      }
      setMessage(t('admin.pollas.created', { code: data.adminCode ?? '' }))
      setName('')
      router.refresh()
    } catch {
      setMessage(t('score.noConnection'))
    } finally {
      setBusy(false)
    }
  }

  async function copyAdminLink(code: string) {
    const url = `${window.location.origin}/invitacion/${code}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(code)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      window.prompt(t('admin.invites.copyPrompt'), url)
    }
  }

  async function joinPolla(pollaId: number) {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join-polla', pollaId }),
      })
      const data = (await res.json()) as { ok: boolean; error?: string }
      setMessage(
        data.ok
          ? t('admin.pollas.joined')
          : data.error
            ? apiError(data.error)
            : t('admin.pollas.joinFail')
      )
      router.refresh()
    } catch {
      setMessage(t('score.noConnection'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-slate-400">
          {t('admin.pollas.newName')}
          <input
            className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
            value={name}
            maxLength={60}
            placeholder={t('admin.pollas.newPlaceholder')}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={busy || name.trim().length < 3}
          onClick={createPolla}
          className="rounded-lg bg-emerald-500 px-3.5 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-60"
        >
          {busy ? t('admin.pollas.creating') : t('admin.pollas.create')}
        </button>
      </div>
      {message && <p className="text-xs text-slate-300">{message}</p>}

      <ul className="flex flex-col gap-2">
        {pollas.map((polla) => (
          <li
            key={polla.id}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm"
          >
            <span className="font-bold">
              {polla.name}
              {polla.id === currentPollaId && (
                <span className="ml-1.5 text-xs font-normal text-emerald-400">
                  {t('admin.pollas.yours')}
                </span>
              )}
            </span>
            <span className="text-xs text-slate-500">
              {t('admin.pollas.stats', { entries: polla.entryCount, users: polla.userCount })}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-slate-400">
              {polla.adminName ? (
                t('admin.pollas.admin', { name: polla.adminName })
              ) : polla.pendingAdminCode ? (
                <span className="text-amber-300">{t('admin.pollas.waiting')}</span>
              ) : (
                <span className="italic">{t('admin.pollas.noAdmin')}</span>
              )}
            </span>
            <span className="flex items-center gap-1.5">
              {polla.pendingAdminCode && (
                <button
                  type="button"
                  onClick={() => copyAdminLink(polla.pendingAdminCode as string)}
                  className="rounded-md bg-amber-500/15 px-2 py-1 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/25"
                >
                  {copied === polla.pendingAdminCode
                    ? t('admin.pollas.copied')
                    : t('admin.pollas.copyAdmin')}
                </button>
              )}
              {!myPollaIds.includes(polla.id) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => joinPolla(polla.id)}
                  title={t('admin.pollas.joinTitle')}
                  className="rounded-md bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
                >
                  {t('admin.pollas.join')}
                </button>
              )}
              <Link
                href={`/posiciones?polla=${polla.id}`}
                className="rounded-md bg-sky-500/15 px-2 py-1 text-xs font-semibold text-sky-300 transition-colors hover:bg-sky-500/25"
              >
                {t('admin.pollas.viewTable')}
              </Link>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
