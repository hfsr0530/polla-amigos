import { redirect } from 'next/navigation'
import { getSession } from '@/features/auth/session'
import { listEntriesWithMembers } from '@/features/entries/service'
import { getAllTeams, getTournamentStartUtc } from '@/features/matches/service'
import {
  areAwardsLocked,
  getAllAwardPicks,
  getAwardResults,
  getEntryAwardPicks,
  isPickCorrect,
} from '@/features/awards/service'
import { AwardsForm } from '@/features/awards/components/AwardsForm'
import { listPlayers, playerLabel } from '@/features/players/service'
import { DEFAULT_RULES } from '@/features/scoring/rules'
import { LocalTime } from '@/shared/components/LocalTime'
import { getT } from '@/shared/i18n/server'
import type { TKey } from '@/shared/i18n/dictionary'
import type { AwardKey } from '@/shared/types/domain'
import { PLAYER_AWARDS, TEAM_AWARDS } from '@/shared/types/domain'
import { cn } from '@/shared/lib/utils'

export const dynamic = 'force-dynamic'

const ALL_AWARDS: readonly AwardKey[] = [...TEAM_AWARDS, ...PLAYER_AWARDS]

export default async function AwardsPage() {
  const user = await getSession()
  if (!user) redirect('/login')

  const [t, locked, start, teams] = await Promise.all([
    getT(),
    areAwardsLocked(),
    getTournamentStartUtc(),
    getAllTeams(),
  ])

  if (!locked) {
    const [myPicks, players] = await Promise.all([
      getEntryAwardPicks(user.entryId),
      listPlayers(),
    ])
    const labelById = new Map(players.map((p) => [p.id, playerLabel(p)]))
    const initialPicks: Partial<
      Record<AwardKey, { teamId: number | null; playerLabel: string | null }>
    > = {}
    for (const [award, pick] of myPicks) {
      initialPicks[award] = {
        teamId: pick.teamId,
        playerLabel: pick.playerId
          ? (labelById.get(pick.playerId) ?? pick.playerName)
          : pick.playerName,
      }
    }

    return (
      <div className="flex flex-col gap-4">
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight">{t('awards.title')}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {t('awards.deadlineNoDate')}
            {start && (
              <>
                {' '}
                (<LocalTime iso={start} mode="datetime" />)
              </>
            )}
          </p>
        </header>

        {teams.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
            {t('awards.needsSync')}
          </section>
        ) : (
          <AwardsForm
            teams={teams.map((tm) => ({ id: tm.id, name: tm.name }))}
            players={players.map((p) => ({ id: p.id, label: playerLabel(p) }))}
            initialPicks={initialPicks}
            points={DEFAULT_RULES.awards}
          />
        )}
      </div>
    )
  }

  // Torneo iniciado: picks bloqueados y visibles para tu polla
  const [entries, allPicks, results] = await Promise.all([
    listEntriesWithMembers(user.pollaId),
    getAllAwardPicks(user.pollaId),
    getAwardResults(),
  ])
  const teamName = new Map(teams.map((tm) => [tm.id, tm.name]))
  const nameById = new Map(entries.map((e) => [e.id, e.name]))

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">{t('awards.title')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('awards.lockedIntro')}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {ALL_AWARDS.map((award) => {
          const result = results.get(award)
          const official = result
            ? (result.teamId ? teamName.get(result.teamId) : result.playerName) ?? null
            : null
          const picks = allPicks.filter((p) => p.award === award)

          return (
            <section
              key={award}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
            >
              <header className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-300">
                  {t(`award.${award}` as TKey)}
                </h2>
                {official ? (
                  <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                    🏅 {official}
                  </span>
                ) : (
                  <span className="text-xs italic text-slate-500">{t('awards.official')}</span>
                )}
              </header>
              {picks.length === 0 ? (
                <p className="text-xs italic text-slate-500">{t('awards.nobodyPicked')}</p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {picks.map((pick) => {
                    const correct = isPickCorrect(pick, result)
                    const label = pick.teamId ? teamName.get(pick.teamId) : pick.playerName
                    return (
                      <li
                        key={`${pick.entryId}-${pick.award}`}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="truncate text-slate-300">
                          {nameById.get(pick.entryId) ?? '—'}
                        </span>
                        <span
                          className={cn(
                            'flex items-center gap-1.5 font-medium',
                            correct === true && 'text-emerald-400',
                            correct === false && 'text-slate-500'
                          )}
                        >
                          {label ?? '—'}
                          {correct === true && (
                            <span aria-label={t('awards.correct')}>✓</span>
                          )}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
