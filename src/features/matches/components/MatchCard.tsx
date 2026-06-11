import { LocalTime } from '@/shared/components/LocalTime'
import { TeamBadge } from '@/shared/components/TeamBadge'
import { ScoreInput } from '@/features/predictions/components/ScoreInput'
import type { MatchScoreBreakdown } from '@/features/scoring/engine'
import type { MatchWithTeams } from '@/shared/types/domain'
import type { TFunc, TKey } from '@/shared/i18n/dictionary'
import { cn } from '@/shared/lib/utils'

export interface PeerPrediction {
  name: string
  home: number
  away: number
}

interface MatchCardProps {
  match: MatchWithTeams
  myPrediction: { home: number; away: number } | null
  breakdown: MatchScoreBreakdown | null
  /** El kickoff ya pasó: se revelan los pronósticos de los demás */
  started: boolean
  /** El candado de -10 min ya cayó: no se puede editar el pronóstico */
  locked: boolean
  peerPredictions: PeerPrediction[]
  t: TFunc
}

export function MatchCard({
  match,
  myPrediction,
  breakdown,
  started,
  locked,
  peerPredictions,
  t,
}: MatchCardProps) {
  const isLive = match.status === 'LIVE'
  const isFinished = match.status === 'FINISHED'
  const hasTeams = match.homeTeam !== null && match.awayTeam !== null
  const canPredict = !locked && hasTeams && match.status === 'SCHEDULED'
  const stageLabel =
    match.stage === 'GROUP'
      ? t('matches.group', { name: match.groupName ?? '?' })
      : t(`stage.${match.stage}` as TKey)

  return (
    <article
      className={cn(
        'rounded-2xl border bg-slate-900/60 p-3 transition-colors sm:p-4',
        isLive ? 'border-emerald-500/40 shadow-lg shadow-emerald-500/5' : 'border-slate-800'
      )}
    >
      <header className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-400">
        <span className="font-medium uppercase tracking-wide">{stageLabel}</span>
        <span className="flex items-center gap-2">
          {isLive ? (
            <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              {t('matches.live')}
              {match.minute && !/^\D*$/.test(match.minute) ? ` · ${match.minute}` : ''}
            </span>
          ) : isFinished ? (
            <span className="font-semibold text-slate-300">{t('matches.finished')}</span>
          ) : (
            <LocalTime iso={match.kickoffUtc} />
          )}
        </span>
      </header>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
        <TeamBadge team={match.homeTeam} fallbackLabel={match.homeLabel ?? t('matches.tbd')} />

        <div className="flex flex-col items-center gap-1">
          {isLive || isFinished ? (
            <p className="text-xl font-extrabold tabular-nums sm:text-2xl">
              {match.homeGoals ?? '–'}
              <span className="mx-1 text-slate-500">:</span>
              {match.awayGoals ?? '–'}
            </p>
          ) : null}

          {canPredict ? (
            <ScoreInput
              matchId={match.id}
              initialHome={myPrediction?.home ?? null}
              initialAway={myPrediction?.away ?? null}
            />
          ) : !isLive && !isFinished ? (
            <p className="text-sm italic text-slate-500">
              {hasTeams ? t('matches.closed') : t('matches.tbd')}
            </p>
          ) : null}
        </div>

        <TeamBadge
          team={match.awayTeam}
          fallbackLabel={match.awayLabel ?? t('matches.tbd')}
          align="right"
        />
      </div>

      {(isLive || isFinished) && (
        <footer className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-2 text-xs">
          <span className="text-slate-400">
            {t('matches.yourPrediction')}{' '}
            {myPrediction ? (
              <strong className="tabular-nums text-slate-200">
                {myPrediction.home}:{myPrediction.away}
              </strong>
            ) : (
              <em className="text-slate-500">{t('matches.noPrediction')}</em>
            )}
          </span>
          {breakdown && (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 font-bold tabular-nums',
                breakdown.total > 0
                  ? isFinished
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'animate-pulse bg-amber-500/15 text-amber-300'
                  : 'bg-slate-800 text-slate-500'
              )}
              title={t('matches.breakdown', {
                outcome: breakdown.outcome,
                exact: breakdown.exactScore,
                teamGoals: breakdown.teamGoals,
              })}
            >
              +{breakdown.total} {isFinished ? t('matches.pts') : t('matches.provisional')}
            </span>
          )}
        </footer>
      )}

      {started && peerPredictions.length > 0 && (
        <details className="mt-2 border-t border-slate-800 pt-2">
          <summary className="cursor-pointer text-xs font-medium text-sky-400 hover:text-sky-300">
            {t('matches.peers', { n: peerPredictions.length })}
          </summary>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-300 sm:grid-cols-3">
            {peerPredictions.map((p) => (
              <li key={p.name} className="flex items-center justify-between gap-2">
                <span className="truncate">{p.name}</span>
                <span className="font-semibold tabular-nums">
                  {p.home}:{p.away}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  )
}
