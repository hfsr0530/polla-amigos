'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/shared/i18n/I18nProvider'

export interface MembershipOption {
  entryId: number
  pollaId: number
  pollaName: string
  isActive: boolean
}

interface PollaSwitcherProps {
  memberships: MembershipOption[]
}

// Cambia la polla activa de la sesión (visible solo con 2+ membresías)
export function PollaSwitcher({ memberships }: PollaSwitcherProps) {
  const router = useRouter()
  const t = useT()
  const [busy, setBusy] = useState(false)
  const active = memberships.find((m) => m.isActive)

  async function handleChange(entryId: number) {
    setBusy(true)
    try {
      await fetch('/api/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'switch', entryId }),
      })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <label className="flex items-center">
      <span className="sr-only">{t('nav.switchPolla')}</span>
      <select
        value={active?.entryId ?? ''}
        disabled={busy}
        onChange={(e) => handleChange(Number(e.target.value))}
        className="max-w-[9rem] cursor-pointer truncate rounded-md border-0 bg-transparent py-0 pl-0 pr-5 text-[11px] text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 disabled:opacity-50"
      >
        {memberships.map((m) => (
          <option key={m.entryId} value={m.entryId} className="bg-slate-900 text-slate-200">
            {m.pollaName}
          </option>
        ))}
      </select>
    </label>
  )
}
