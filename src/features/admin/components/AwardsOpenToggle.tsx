'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/shared/i18n/I18nProvider'
import { cn } from '@/shared/lib/utils'

// Permite al admin (o superadmin) re-habilitar la edición de premios de su
// polla, anulando el bloqueo automático por horario.
export function AwardsOpenToggle({ open }: { open: boolean }) {
  const router = useRouter()
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [value, setValue] = useState(open)

  async function setOpen(next: boolean) {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/awards-open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ open: next }),
      })
      const data = (await res.json()) as { ok: boolean }
      if (data.ok) {
        setValue(next)
        router.refresh()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className={cn('text-sm', value ? 'font-medium text-emerald-300' : 'text-slate-400')}>
        {value ? t('admin.awardsOpen.statusOpen') : t('admin.awardsOpen.statusClosed')}
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen(!value)}
        className={cn(
          'shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60',
          value
            ? 'border border-slate-600 text-slate-300 hover:border-slate-400'
            : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
        )}
      >
        {value ? t('admin.awardsOpen.disable') : t('admin.awardsOpen.enable')}
      </button>
    </div>
  )
}
