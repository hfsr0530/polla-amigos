'use client'

import { useState } from 'react'
import { useApiError, useT } from '@/shared/i18n/I18nProvider'
import type { TKey } from '@/shared/i18n/dictionary'
import type { AwardKey } from '@/shared/types/domain'
import { PLAYER_AWARDS, TEAM_AWARDS } from '@/shared/types/domain'

interface TeamOption {
  id: number
  name: string
}

export interface PlayerListOption {
  id: number
  label: string
}

interface AwardsFormProps {
  teams: TeamOption[]
  /** Catálogo de jugadores ("Nombre · TLA") para los premios individuales */
  players: PlayerListOption[]
  initialPicks: Partial<Record<AwardKey, { teamId: number | null; playerLabel: string | null }>>
  /** Puntos por premio: vienen de las reglas del servidor (única fuente de verdad) */
  points: Record<AwardKey, number>
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function AwardsForm({ teams, players, initialPicks, points }: AwardsFormProps) {
  const t = useT()
  const apiError = useApiError()
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {}
    for (const award of TEAM_AWARDS) {
      v[award] = initialPicks[award]?.teamId ? String(initialPicks[award]?.teamId) : ''
    }
    for (const award of PLAYER_AWARDS) {
      v[award] = initialPicks[award]?.playerLabel ?? ''
    }
    return v
  })
  const [states, setStates] = useState<Record<string, SaveState>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function save(award: AwardKey) {
    const isTeam = TEAM_AWARDS.includes(award)
    const raw = (values[award] ?? '').trim()
    if (!raw) {
      setErrors((e) => ({
        ...e,
        [award]: isTeam ? t('awards.chooseTeam') : t('awards.pickFromList'),
      }))
      setStates((s) => ({ ...s, [award]: 'error' }))
      return
    }

    // El jugador debe existir en el catálogo: nada de texto libre
    let playerId: number | undefined
    if (!isTeam) {
      const player = players.find((p) => p.label === raw)
      if (!player) {
        setErrors((e) => ({ ...e, [award]: t('awards.pickFromList') }))
        setStates((s) => ({ ...s, [award]: 'error' }))
        return
      }
      playerId = player.id
    }

    setStates((s) => ({ ...s, [award]: 'saving' }))
    setErrors((e) => ({ ...e, [award]: '' }))
    try {
      const res = await fetch('/api/awards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isTeam ? { award, teamId: Number(raw) } : { award, playerId }),
      })
      const data = (await res.json()) as { ok: boolean; error?: string }
      if (!data.ok) {
        setErrors((e) => ({
          ...e,
          [award]: data.error ? apiError(data.error) : t('score.saveError'),
        }))
        setStates((s) => ({ ...s, [award]: 'error' }))
        return
      }
      setStates((s) => ({ ...s, [award]: 'saved' }))
    } catch {
      setErrors((e) => ({ ...e, [award]: t('score.noConnection') }))
      setStates((s) => ({ ...s, [award]: 'error' }))
    }
  }

  function renderStatus(award: AwardKey) {
    const state = states[award]
    if (state === 'saved') return <span className="text-xs text-emerald-400">{t('score.saved')}</span>
    if (state === 'error' && errors[award])
      return (
        <span role="alert" className="text-xs text-red-400">
          {errors[award]}
        </span>
      )
    return null
  }

  const fieldClasses =
    'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-colors'

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
        <h2 className="mb-1 text-base font-bold">{t('awards.podium')}</h2>
        <p className="mb-4 text-xs text-slate-400">{t('awards.podiumHint')}</p>
        <div className="flex flex-col gap-4">
          {TEAM_AWARDS.map((award) => (
            <div key={award} className="flex flex-col gap-1">
              <label
                htmlFor={`award-${award}`}
                className="flex items-baseline justify-between text-sm"
              >
                <span className="font-medium text-slate-200">{t(`award.${award}` as TKey)}</span>
                <span className="text-xs font-bold text-amber-400">
                  {t('awards.pts', { n: points[award] })}
                </span>
              </label>
              <div className="flex items-center gap-2">
                <select
                  id={`award-${award}`}
                  className={fieldClasses}
                  value={values[award]}
                  onChange={(e) => {
                    setValues((v) => ({ ...v, [award]: e.target.value }))
                    setStates((s) => ({ ...s, [award]: 'idle' }))
                  }}
                >
                  <option value="">{t('awards.chooseTeam')}</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => save(award)}
                  disabled={states[award] === 'saving'}
                  className="shrink-0 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-60"
                >
                  {states[award] === 'saving' ? '…' : t('score.save')}
                </button>
              </div>
              {renderStatus(award)}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
        <h2 className="mb-1 text-base font-bold">{t('awards.individual')}</h2>
        <p className="mb-4 text-xs text-slate-400">
          {players.length === 0 ? t('awards.squadsMissing') : t('awards.individualHint')}
        </p>
        <div className="flex flex-col gap-4">
          {PLAYER_AWARDS.map((award) => (
            <div key={award} className="flex flex-col gap-1">
              <label
                htmlFor={`award-${award}`}
                className="flex items-baseline justify-between text-sm"
              >
                <span className="font-medium text-slate-200">{t(`award.${award}` as TKey)}</span>
                <span className="text-xs font-bold text-amber-400">
                  {t('awards.pts', { n: points[award] })}
                </span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={`award-${award}`}
                  list="players-catalog"
                  className={fieldClasses}
                  value={values[award]}
                  disabled={players.length === 0}
                  maxLength={80}
                  placeholder={t('awards.playerSearch')}
                  autoComplete="off"
                  onChange={(e) => {
                    setValues((v) => ({ ...v, [award]: e.target.value }))
                    setStates((s) => ({ ...s, [award]: 'idle' }))
                  }}
                />
                <button
                  type="button"
                  onClick={() => save(award)}
                  disabled={states[award] === 'saving' || players.length === 0}
                  className="shrink-0 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-60"
                >
                  {states[award] === 'saving' ? '…' : t('score.save')}
                </button>
              </div>
              {renderStatus(award)}
            </div>
          ))}
        </div>

        {/* Catálogo compartido por los 4 buscadores (filtra al escribir) */}
        <datalist id="players-catalog">
          {players.map((p) => (
            <option key={p.id} value={p.label} />
          ))}
        </datalist>
      </section>
    </div>
  )
}
