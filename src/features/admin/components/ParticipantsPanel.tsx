'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApiError, useT } from '@/shared/i18n/I18nProvider'
import { cn } from '@/shared/lib/utils'

export interface PanelMember {
  userId: number
  displayName: string
  isSuperadmin: boolean
}

export interface PanelEntry {
  id: number
  name: string
  kind: 'INDIVIDUAL' | 'PAIR'
  members: PanelMember[]
}

interface ParticipantsPanelProps {
  entries: PanelEntry[]
}

// Renombrar entradas y eliminar cuentas (solo el superadmin llega aquí)
export function ParticipantsPanel({ entries }: ParticipantsPanelProps) {
  const router = useRouter()
  const t = useT()
  const apiError = useApiError()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function startEdit(entry: PanelEntry) {
    setEditingId(entry.id)
    setDraft(entry.name)
    setMessage(null)
  }

  async function saveRename(entryId: number) {
    setBusy(true)
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', entryId, name: draft }),
      })
      const data = (await res.json()) as { ok: boolean; error?: string }
      if (!data.ok) {
        setMessage(data.error ? apiError(data.error) : t('score.saveError'))
        return
      }
      setMessage(t('admin.people.renamed'))
      setEditingId(null)
      router.refresh()
    } catch {
      setMessage(t('score.noConnection'))
    } finally {
      setBusy(false)
    }
  }

  async function removeUser(userId: number, name: string) {
    if (!window.confirm(t('admin.people.deleteUserConfirm', { name }))) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', userId }),
      })
      const data = (await res.json()) as { ok: boolean; error?: string }
      setMessage(
        data.ok ? t('admin.people.deletedUser') : data.error ? apiError(data.error) : t('score.saveError')
      )
      router.refresh()
    } catch {
      setMessage(t('score.noConnection'))
    } finally {
      setBusy(false)
    }
  }

  if (entries.length === 0) {
    return <p className="text-sm italic text-slate-500">{t('admin.people.empty')}</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {message && <p className="text-xs text-slate-300">{message}</p>}
      <ul className="flex flex-col gap-2">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              {editingId === entry.id ? (
                <>
                  <input
                    value={draft}
                    maxLength={40}
                    autoFocus
                    onChange={(e) => setDraft(e.target.value)}
                    className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => saveRename(entry.id)}
                    className="rounded-md bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-60"
                  >
                    {t('score.save')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:text-white"
                  >
                    {t('admin.people.cancel')}
                  </button>
                </>
              ) : (
                <>
                  <span className="font-semibold">
                    {entry.name}
                    {entry.kind === 'PAIR' && <span className="ml-1.5 text-xs">👥</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(entry)}
                    className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-sky-300 transition-colors hover:bg-slate-700"
                  >
                    {t('admin.people.rename')}
                  </button>
                </>
              )}
            </div>

            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {entry.members.map((m) => (
                <li key={m.userId} className="flex items-center gap-1.5 text-slate-300">
                  <span>{m.displayName}</span>
                  {m.isSuperadmin ? (
                    <span className="text-xs text-amber-400">{t('admin.people.superadmin')}</span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => removeUser(m.userId, m.displayName)}
                      title={t('admin.people.deleteUser')}
                      className={cn(
                        'rounded px-1.5 py-0.5 text-xs font-bold text-red-400 transition-colors',
                        'bg-slate-800 hover:bg-red-500 hover:text-slate-950 disabled:opacity-50'
                      )}
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}
