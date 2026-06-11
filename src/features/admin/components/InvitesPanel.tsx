'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/shared/lib/utils'
import { useApiError, useT } from '@/shared/i18n/I18nProvider'

export interface InviteView {
  code: string
  kind: 'INDIVIDUAL' | 'PAIR'
  label: string | null
  revoked: boolean
  slotsLeft: number
  entryName: string | null
  usedBy: string[]
}

interface InvitesPanelProps {
  invites: InviteView[]
  /** true si la entrada del admin todavía tiene cupo para su pareja */
  canInviteToMyEntry: boolean
}

type InviteKind = 'INDIVIDUAL' | 'PAIR' | 'JOIN_MY'

export function InvitesPanel({ invites, canInviteToMyEntry }: InvitesPanelProps) {
  const router = useRouter()
  const t = useT()
  const apiError = useApiError()
  const [kind, setKind] = useState<InviteKind>('INDIVIDUAL')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  async function createInvite() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          kind === 'JOIN_MY'
            ? { action: 'create', joinMyEntry: true, label: label || undefined }
            : { action: 'create', kind, label: label || undefined }
        ),
      })
      const data = (await res.json()) as { ok: boolean; code?: string; error?: string }
      if (!data.ok) {
        setMessage(data.error ? apiError(data.error) : t('admin.invites.createError'))
        return
      }
      setMessage(t('admin.invites.created', { code: data.code ?? '' }))
      setLabel('')
      router.refresh()
    } catch {
      setMessage(t('score.noConnection'))
    } finally {
      setBusy(false)
    }
  }

  async function revoke(code: string) {
    await fetch('/api/admin/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'revoke', code }),
    })
    router.refresh()
  }

  async function copyLink(code: string) {
    const url = `${window.location.origin}/invitacion/${code}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(code)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // clipboard bloqueado (HTTP sin TLS): mostrar el link para copiarlo a mano
      window.prompt(t('admin.invites.copyPrompt'), url)
    }
  }

  const fieldClasses =
    'rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          {t('admin.invites.type')}
          <select
            className={fieldClasses}
            value={kind}
            onChange={(e) => setKind(e.target.value as InviteKind)}
          >
            <option value="INDIVIDUAL">{t('admin.invites.individual')}</option>
            <option value="PAIR">{t('admin.invites.pair')}</option>
            {canInviteToMyEntry && <option value="JOIN_MY">{t('admin.invites.joinMy')}</option>}
          </select>
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-slate-400">
          {t('admin.invites.forWho')}
          <input
            className={fieldClasses}
            value={label}
            maxLength={60}
            placeholder={t('admin.invites.forWhoPlaceholder')}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={createInvite}
          className="rounded-lg bg-emerald-500 px-3.5 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-60"
        >
          {busy ? t('admin.invites.creating') : t('admin.invites.create')}
        </button>
      </div>
      {message && <p className="text-xs text-slate-300">{message}</p>}

      {invites.length === 0 ? (
        <p className="text-sm italic text-slate-500">{t('admin.invites.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {invites.map((invite) => {
            const complete = !invite.revoked && invite.slotsLeft === 0
            const active = !invite.revoked && invite.slotsLeft > 0
            return (
              <li
                key={invite.code}
                className={cn(
                  'flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm',
                  active ? 'border-slate-700 bg-slate-950/60' : 'border-slate-800 bg-slate-900/40 opacity-75'
                )}
              >
                <code className="font-mono text-base font-bold tracking-widest text-emerald-300">
                  {invite.code}
                </code>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-300">
                  {invite.kind === 'PAIR' ? t('admin.invites.pairTag') : t('admin.invites.individualTag')}
                </span>
                {invite.label && <span className="text-xs text-slate-400">{invite.label}</span>}
                <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
                  {invite.revoked
                    ? t('admin.invites.revoked')
                    : complete
                      ? t('admin.invites.complete', { names: invite.usedBy.join(' + ') })
                      : invite.usedBy.length > 0
                        ? t('admin.invites.oneSlot', { names: invite.usedBy.join(' + ') })
                        : t('admin.invites.unused')}
                </span>
                <span className="flex items-center gap-1.5">
                  {active && (
                    <button
                      type="button"
                      onClick={() => copyLink(invite.code)}
                      className="rounded-md bg-sky-500/15 px-2 py-1 text-xs font-semibold text-sky-300 transition-colors hover:bg-sky-500/25"
                    >
                      {copied === invite.code ? t('admin.invites.copied') : t('admin.invites.copyLink')}
                    </button>
                  )}
                  {active && (
                    <button
                      type="button"
                      onClick={() => revoke(invite.code)}
                      className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400 transition-colors hover:border-red-500/50 hover:text-red-300"
                    >
                      {t('admin.invites.revoke')}
                    </button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
