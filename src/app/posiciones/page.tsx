import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/features/auth/session'
import { computeLeaderboard } from '@/features/leaderboard/service'
import { getPolla, listPollas } from '@/features/pollas/service'
import { maybeSync } from '@/features/livescore/sync'
import { AutoRefresh } from '@/shared/components/AutoRefresh'
import { getT } from '@/shared/i18n/server'
import { cn } from '@/shared/lib/utils'

export const dynamic = 'force-dynamic'

const MEDALS = ['🥇', '🥈', '🥉']

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ polla?: string }>
}) {
  const user = await getSession()
  if (!user) redirect('/login')

  await maybeSync()

  // El superadmin puede mirar la tabla de cualquier polla con ?polla=N
  const params = await searchParams
  const requested = Number(params.polla)
  const pollaId =
    user.isSuperadmin && Number.isInteger(requested) && requested > 0
      ? requested
      : user.pollaId

  const [t, polla, allPollas, rows] = await Promise.all([
    getT(),
    getPolla(pollaId),
    user.isSuperadmin ? listPollas() : Promise.resolve([]),
    computeLeaderboard(pollaId),
  ])
  const anyLive = rows.some((r) => r.livePoints > 0)

  return (
    <div className="flex flex-col gap-4">
      <AutoRefresh seconds={60} />

      <header className="flex flex-col gap-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{t('standings.title')}</h1>
          {polla && <p className="mt-0.5 text-sm text-slate-400">{polla.name}</p>}
          {allPollas.length > 1 && (
            <nav aria-label="Pollas" className="mt-2 flex flex-wrap gap-1.5">
              {allPollas.map((p) => (
                <Link
                  key={p.id}
                  href={`/posiciones?polla=${p.id}`}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
                    p.id === pollaId
                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                      : 'border-slate-700 text-slate-400 hover:border-slate-500'
                  )}
                >
                  {p.name}
                </Link>
              ))}
            </nav>
          )}
          {anyLive && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative h-2 w-2 rounded-full bg-amber-500" />
              </span>
              {t('standings.liveNote')}
            </p>
          )}
        </div>
      </header>

      {rows.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
          {t('standings.empty')}
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-400">
                <th scope="col" className="px-3 py-2.5 text-center">#</th>
                <th scope="col" className="px-3 py-2.5">{t('standings.participant')}</th>
                <th scope="col" className="hidden px-3 py-2.5 text-right sm:table-cell">
                  {t('standings.matches')}
                </th>
                <th scope="col" className="hidden px-3 py-2.5 text-right sm:table-cell">
                  {t('standings.awards')}
                </th>
                <th scope="col" className="hidden px-3 py-2.5 text-right md:table-cell">
                  {t('standings.exact')}
                </th>
                <th scope="col" className="px-3 py-2.5 text-right">{t('standings.points')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isMe = row.entry.id === user.entryId
                const isPair = row.entry.kind === 'PAIR'
                return (
                  <tr
                    key={row.entry.id}
                    className={cn(
                      'border-b border-slate-800/60 transition-colors last:border-0 hover:bg-slate-900/60',
                      isMe && 'bg-emerald-500/5'
                    )}
                  >
                    <td className="px-3 py-2.5 text-center font-bold tabular-nums text-slate-400">
                      {row.position <= 3 ? (
                        <span
                          className="text-base"
                          aria-label={t('standings.position', { n: row.position })}
                        >
                          {MEDALS[row.position - 1]}
                        </span>
                      ) : (
                        row.position
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/participante/${row.entry.id}`}
                        className="font-medium text-slate-100 hover:text-emerald-300 hover:underline"
                      >
                        {row.entry.name}
                        {isPair && (
                          <span
                            className="ml-1.5 text-xs"
                            title={t('standings.pair')}
                            aria-label={t('standings.pair')}
                          >
                            👥
                          </span>
                        )}
                        {isMe && (
                          <span className="ml-1.5 text-xs text-emerald-400">
                            {t('standings.you')}
                          </span>
                        )}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {isPair && row.entry.members.length > 0 ? (
                          row.entry.members.join(' + ')
                        ) : (
                          <span className="sm:hidden">
                            {row.matchPoints} {t('standings.matches').toLowerCase()} ·{' '}
                            {row.awardPoints} {t('standings.awards').toLowerCase()}
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="hidden px-3 py-2.5 text-right tabular-nums text-slate-300 sm:table-cell">
                      {row.matchPoints}
                    </td>
                    <td className="hidden px-3 py-2.5 text-right tabular-nums text-slate-300 sm:table-cell">
                      {row.awardPoints}
                    </td>
                    <td className="hidden px-3 py-2.5 text-right tabular-nums text-slate-300 md:table-cell">
                      {row.exactScores}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-base font-extrabold tabular-nums">{row.points}</span>
                      {row.livePoints > 0 && (
                        <span className="ml-1.5 animate-pulse rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-amber-300">
                          +{row.livePoints}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}

      <p className="text-xs text-slate-500">{t('standings.footer')}</p>
    </div>
  )
}
