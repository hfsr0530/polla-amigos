'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/shared/i18n/I18nProvider'
import type { AwardKey } from '@/shared/types/domain'
import { cn } from '@/shared/lib/utils'

interface PickOverrideButtonsProps {
  entryId: number
  award: AwardKey
  current: boolean | null
}

// Permite al admin corregir el matching automático de nombres de jugadores
export function PickOverrideButtons({ entryId, award, current }: PickOverrideButtonsProps) {
  const router = useRouter()
  const t = useT()
  const [busy, setBusy] = useState(false)

  async function setOverride(correct: boolean | null) {
    setBusy(true)
    try {
      await fetch('/api/admin/awards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'override', award, entryId, correct }),
      })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const baseClasses =
    'rounded px-1.5 py-0.5 text-xs font-bold transition-colors disabled:opacity-50'

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => setOverride(true)}
        title={t('admin.validate.markHit')}
        className={cn(
          baseClasses,
          current === true
            ? 'bg-emerald-500 text-slate-950'
            : 'bg-slate-800 text-emerald-400 hover:bg-slate-700'
        )}
      >
        ✓
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => setOverride(false)}
        title={t('admin.validate.markMiss')}
        className={cn(
          baseClasses,
          current === false
            ? 'bg-red-500 text-slate-950'
            : 'bg-slate-800 text-red-400 hover:bg-slate-700'
        )}
      >
        ✗
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => setOverride(null)}
        title={t('admin.validate.markAuto')}
        className={cn(
          baseClasses,
          current === null
            ? 'bg-sky-500 text-slate-950'
            : 'bg-slate-800 text-sky-400 hover:bg-slate-700'
        )}
      >
        auto
      </button>
    </span>
  )
}
