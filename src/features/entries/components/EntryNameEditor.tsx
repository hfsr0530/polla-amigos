'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApiError, useT } from '@/shared/i18n/I18nProvider'

interface EntryNameEditorProps {
  entryId: number
  currentName: string
}

// Permite al dueño de una entrada (p. ej. su pareja) renombrarla desde su página
export function EntryNameEditor({ entryId, currentName }: EntryNameEditorProps) {
  const router = useRouter()
  const t = useT()
  const apiError = useApiError()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(currentName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', entryId, name: draft }),
      })
      const data = (await res.json()) as { ok: boolean; error?: string }
      if (!data.ok) {
        setError(data.error ? apiError(data.error) : t('score.saveError'))
        return
      }
      setEditing(false)
      router.refresh()
    } catch {
      setError(t('score.noConnection'))
    } finally {
      setBusy(false)
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(currentName)
          setEditing(true)
        }}
        className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-sky-300 transition-colors hover:bg-slate-700"
      >
        {t('entry.editName')}
      </button>
    )
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <input
        value={draft}
        maxLength={40}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        className="w-40 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-white focus:border-emerald-500 focus:outline-none"
      />
      <button
        type="button"
        disabled={busy}
        onClick={save}
        className="rounded-md bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-60"
      >
        {t('score.save')}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:text-white"
      >
        {t('admin.people.cancel')}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-400">
          {error}
        </span>
      )}
    </span>
  )
}
