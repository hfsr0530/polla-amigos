'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApiError, useT } from '@/shared/i18n/I18nProvider'
import type { TKey } from '@/shared/i18n/dictionary'
import type { AwardKey } from '@/shared/types/domain'
import { PLAYER_AWARDS, TEAM_AWARDS } from '@/shared/types/domain'

interface TeamOption {
  id: number
  name: string
}

interface PlayerOption {
  id: number
  label: string
}

interface OfficialAwardsPanelProps {
  teams: TeamOption[]
  /** Catálogo de jugadores ("Nombre · TLA"): los oficiales también se eligen de lista */
  players: PlayerOption[]
  current: Partial<Record<AwardKey, { teamId: number | null; playerLabel: string | null }>>
}

export function OfficialAwardsPanel({ teams, players, current }: OfficialAwardsPanelProps) {
  const router = useRouter()
  const t = useT()
  const apiError = useApiError()
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {}
    for (const award of TEAM_AWARDS) {
      v[award] = current[award]?.teamId ? String(current[award]?.teamId) : ''
    }
    for (const award of PLAYER_AWARDS) {
      v[award] = current[award]?.playerLabel ?? ''
    }
    return v
  })
  const [busyAward, setBusyAward] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function save(award: AwardKey) {
    const isTeam = (TEAM_AWARDS as readonly string[]).includes(award)
    const raw = (values[award] ?? '').trim()

    // Vacío = limpiar el resultado oficial; con texto debe venir del catálogo
    let playerId: number | null = null
    if (!isTeam && raw) {
      const player = players.find((p) => p.label === raw)
      if (!player) {
        setErrors((e) => ({ ...e, [award]: t('awards.pickFromList') }))
        return
      }
      playerId = player.id
    }
    setErrors((e) => ({ ...e, [award]: '' }))
    setBusyAward(award)
    try {
      const res = await fetch('/api/admin/awards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isTeam
            ? { action: 'result', award, teamId: raw ? Number(raw) : null }
            : { action: 'result', award, playerId }
        ),
      })
      const data = (await res.json()) as { ok: boolean; error?: string }
      if (!data.ok && data.error) {
        setErrors((e) => ({ ...e, [award]: apiError(data.error as string) }))
      }
      router.refresh()
    } finally {
      setBusyAward(null)
    }
  }

  const fieldClasses =
    'w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-white focus:border-amber-500 focus:outline-none'

  return (
    <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {([...TEAM_AWARDS, ...PLAYER_AWARDS] as AwardKey[]).map((award) => {
        const isTeam = (TEAM_AWARDS as readonly string[]).includes(award)
        return (
          <div key={award} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-xs font-medium text-slate-400">
                {t(`award.${award}` as TKey)}
              </span>
              {isTeam ? (
                <select
                  aria-label={t(`award.${award}` as TKey)}
                  className={fieldClasses}
                  value={values[award]}
                  onChange={(e) => setValues((v) => ({ ...v, [award]: e.target.value }))}
                >
                  <option value="">{t('admin.officialAwards.unset')}</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  aria-label={t(`award.${award}` as TKey)}
                  list="players-catalog-admin"
                  className={fieldClasses}
                  placeholder={
                    players.length === 0
                      ? t('admin.officialAwards.unset')
                      : t('awards.playerSearch')
                  }
                  value={values[award]}
                  disabled={players.length === 0}
                  maxLength={80}
                  autoComplete="off"
                  onChange={(e) => setValues((v) => ({ ...v, [award]: e.target.value }))}
                />
              )}
              <button
                type="button"
                disabled={busyAward === award}
                onClick={() => save(award)}
                className="shrink-0 rounded-md bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
              >
                {busyAward === award ? '…' : t('admin.officialAwards.set')}
              </button>
            </div>
            {errors[award] && (
              <span role="alert" className="ml-32 pl-2 text-xs text-red-400">
                {errors[award]}
              </span>
            )}
          </div>
        )
      })}

      <datalist id="players-catalog-admin">
        {players.map((p) => (
          <option key={p.id} value={p.label} />
        ))}
      </datalist>
    </div>
  )
}
