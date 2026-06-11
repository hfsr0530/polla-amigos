import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/features/auth/session'
import { getEntry, listEntriesWithMembers } from '@/features/entries/service'
import { computeLeaderboard, computeEntryMatchScores } from '@/features/leaderboard/service'
import {
  areAwardsLocked,
  getAwardResults,
  getEntryAwardPicks,
  isPickCorrect,
} from '@/features/awards/service'
import { getAllTeams } from '@/features/matches/service'
import { DEFAULT_RULES } from '@/features/scoring/rules'
import { EntryNameEditor } from '@/features/entries/components/EntryNameEditor'
import { LocalTime } from '@/shared/components/LocalTime'
import { getT } from '@/shared/i18n/server'
import type { TKey } from '@/shared/i18n/dictionary'
import type { AwardKey } from '@/shared/types/domain'
import { cn } from '@/shared/lib/utils'

export const dynamic = 'force-dynamic'

function teamLabel(name: string | undefined | null, fallback: string | null, tbd: string): string {
  return name ?? fallback ?? tbd
}

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getSession()
  if (!viewer) redirect('/login')

  const { id } = await params
  const entryId = Number(id)
  if (!Number.isInteger(entryId)) notFound()

  const entry = await getEntry(entryId)
  if (!entry) notFound()
  // Cada quien solo ve participantes de su polla (el superadmin ve todos)
  if (entry.pollaId !== viewer.pollaId && !viewer.isSuperadmin) notFound()

  const [t, entriesWithMembers, leaderboard, scores] = await Promise.all([
    getT(),
    listEntriesWithMembers(entry.pollaId),
    computeLeaderboard(entry.pollaId),
    computeEntryMatchScores(entryId),
  ])
  const members = entriesWithMembers.find((e) => e.id === entryId)?.members ?? []
  const isSelf = viewer.entryId === entryId
  const row = leaderboard.find((r) => r.entry.id === entryId)
  const now = Date.now()

  // Antes del kickoff solo los dueños ven sus pronósticos (anti-copia)
  const visibleScores = scores.filter((s) => isSelf || now >= Date.parse(s.match.kickoffUtc))
  const played = visibleScores.filter((s) => s.prediction !== null)

  const awardsVisible = isSelf || (await areAwardsLocked())
  const picks = awardsVisible
    ? await getEntryAwardPicks(entryId)
    : new Map<AwardKey, never>()
  const results = await getAwardResults()
  const teamName = new Map((await getAllTeams()).map((tm) => [tm.id, tm.name]))

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/posiciones" className="text-xs text-sky-400 hover:underline">
            {t('entry.back')}
          </Link>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
            {entry.name}
            {entry.kind === 'PAIR' && (
              <span className="ml-2 align-middle text-base" title={t('standings.pair')}>
                👥
              </span>
            )}
          </h1>
          {entry.kind === 'PAIR' && members.length > 0 && (
            <p className="mt-0.5 text-sm text-slate-400">{members.join(' + ')}</p>
          )}
          {isSelf && (
            <div className="mt-1.5">
              <EntryNameEditor entryId={entry.id} currentName={entry.name} />
            </div>
          )}
        </div>
        {row && (
          <div className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-2.5 text-center">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">
                {t('entry.position')}
              </p>
              <p className="text-xl font-extrabold tabular-nums">{row.position}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">
                {t('entry.points')}
              </p>
              <p className="text-xl font-extrabold tabular-nums text-emerald-400">{row.points}</p>
            </div>
            <div className="hidden sm:block">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">
                {t('entry.exact')}
              </p>
              <p className="text-xl font-extrabold tabular-nums">{row.exactScores}</p>
            </div>
          </div>
        )}
      </header>

      <section>
        <h2 className="mb-2 text-base font-bold">{t('entry.awardsTitle')}</h2>
        {!awardsVisible ? (
          <p className="rounded-2xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
            {t('entry.awardsSecret')}
          </p>
        ) : picks.size === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-700 p-4 text-sm italic text-slate-500">
            {t('entry.noAwards')}
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {Array.from(picks.values()).map((pick) => {
              const correct = isPickCorrect(pick, results.get(pick.award))
              const label = pick.teamId ? teamName.get(pick.teamId) : pick.playerName
              return (
                <li
                  key={pick.award}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm"
                >
                  <span className="text-slate-400">{t(`award.${pick.award}` as TKey)}</span>
                  <span
                    className={cn(
                      'flex items-center gap-1.5 font-medium',
                      correct === true && 'text-emerald-400',
                      correct === false && 'text-slate-500'
                    )}
                  >
                    {label ?? '—'}
                    {correct === true && (
                      <span className="font-bold">+{DEFAULT_RULES.awards[pick.award]}</span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-base font-bold">{t('entry.matchesTitle')}</h2>
        {played.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-700 p-4 text-sm italic text-slate-500">
            {isSelf ? t('entry.noOwnPredictions') : t('entry.noVisiblePredictions')}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th scope="col" className="px-3 py-2">{t('entry.match')}</th>
                  <th scope="col" className="px-3 py-2">{t('entry.stage')}</th>
                  <th scope="col" className="px-3 py-2 text-center">{t('entry.prediction')}</th>
                  <th scope="col" className="px-3 py-2 text-center">{t('entry.result')}</th>
                  <th scope="col" className="px-3 py-2 text-right">{t('entry.pts')}</th>
                </tr>
              </thead>
              <tbody>
                {played.map(({ match, prediction, breakdown, provisional }) => {
                  const hasResult = match.homeGoals !== null && match.awayGoals !== null
                  return (
                    <tr key={match.id} className="border-b border-slate-800/60 last:border-0">
                      <td className="px-3 py-2">
                        <p className="font-medium">
                          {teamLabel(match.homeTeam?.name, match.homeLabel, t('matches.tbd'))}{' '}
                          <span className="text-slate-500">vs</span>{' '}
                          {teamLabel(match.awayTeam?.name, match.awayLabel, t('matches.tbd'))}
                        </p>
                        <p className="text-xs text-slate-500">
                          <LocalTime iso={match.kickoffUtc} mode="datetime" />
                        </p>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-400">
                        {match.stage === 'GROUP'
                          ? t('matches.group', { name: match.groupName ?? '' })
                          : t(`stage.${match.stage}` as TKey)}
                      </td>
                      <td className="px-3 py-2 text-center font-semibold tabular-nums">
                        {prediction ? `${prediction.home}:${prediction.away}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums">
                        {hasResult ? (
                          <>
                            {match.homeGoals}:{match.awayGoals}
                            {match.status === 'LIVE' && (
                              <span className="ml-1 text-[10px] font-bold text-emerald-400">
                                LIVE
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {hasResult && match.status !== 'SCHEDULED' ? (
                          <span
                            className={cn(
                              'font-bold tabular-nums',
                              breakdown.total > 0
                                ? provisional
                                  ? 'text-amber-300'
                                  : 'text-emerald-400'
                                : 'text-slate-600'
                            )}
                            title={t('matches.breakdown', {
                              outcome: breakdown.outcome,
                              exact: breakdown.exactScore,
                              teamGoals: breakdown.teamGoals,
                            })}
                          >
                            +{breakdown.total}
                            {provisional && '*'}
                          </span>
                        ) : (
                          <span className="text-slate-600">·</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-slate-500">{t('entry.provisionalNote')}</p>
      </section>
    </div>
  )
}
