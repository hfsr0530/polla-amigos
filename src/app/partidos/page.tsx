import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/features/auth/session'
import { listEntriesWithMembers } from '@/features/entries/service'
import { getAllMatches } from '@/features/matches/service'
import { getEntryPredictions, getAllPredictions } from '@/features/predictions/service'
import { areAwardsLocked, getEntryAwardPicks } from '@/features/awards/service'
import { maybeSync } from '@/features/livescore/sync'
import { scoreMatchSafe } from '@/features/scoring/engine'
import { DEFAULT_RULES } from '@/features/scoring/rules'
import { MatchCard, type PeerPrediction } from '@/features/matches/components/MatchCard'
import { AutoRefresh } from '@/shared/components/AutoRefresh'
import { getLang, getT } from '@/shared/i18n/server'
import { PREDICTION_LOCK_MS, type MatchWithTeams } from '@/shared/types/domain'
import { cn } from '@/shared/lib/utils'

export const dynamic = 'force-dynamic'

// Agrupamos los días en la zona de la banda (configurable por env)
const DISPLAY_TZ = process.env.DISPLAY_TZ ?? 'America/Bogota'

type Filter = 'all' | 'group' | 'ko' | 'today' | 'live'
const FILTER_KEYS: Filter[] = ['today', 'live', 'all', 'group', 'ko']

function dayKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DISPLAY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

function dayLabel(iso: string, lang: string): string {
  const label = new Intl.DateTimeFormat(lang, {
    timeZone: DISPLAY_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function applyFilter(matches: MatchWithTeams[], filter: Filter, todayKey: string) {
  switch (filter) {
    case 'group':
      return matches.filter((m) => m.stage === 'GROUP')
    case 'ko':
      return matches.filter((m) => m.stage !== 'GROUP')
    case 'live':
      return matches.filter((m) => m.status === 'LIVE')
    case 'today':
      return matches.filter((m) => dayKey(m.kickoffUtc) === todayKey)
    default:
      return matches
  }
}

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>
}) {
  const user = await getSession()
  if (!user) redirect('/login')

  // Mantiene los datos frescos sin reventar el rate limit del proveedor
  await maybeSync()

  const params = await searchParams
  const [t, lang] = await Promise.all([getT(), getLang()])
  const [matches, myPreds, allPreds, entries, awardsLocked, myAwardPicks] = await Promise.all([
    getAllMatches(),
    getEntryPredictions(user.entryId),
    getAllPredictions(user.pollaId),
    listEntriesWithMembers(user.pollaId),
    areAwardsLocked(),
    getEntryAwardPicks(user.entryId),
  ])
  const now = Date.now()
  // Recordatorio: faltan premios por elegir y el torneo aún no cierra
  const missingAwards = matches.length > 0 && !awardsLocked ? 8 - myAwardPicks.size : 0

  const FILTER_LABELS: Record<Filter, string> = {
    today: t('matches.filter.today'),
    live: t('matches.filter.live'),
    all: t('matches.filter.all'),
    group: t('matches.filter.group'),
    ko: t('matches.filter.ko'),
  }

  const todayKey = dayKey(new Date().toISOString())
  const hasToday = matches.some((m) => dayKey(m.kickoffUtc) === todayKey)
  const requested = (params.filtro as Filter | undefined) ?? (hasToday ? 'today' : 'all')
  const filter: Filter = FILTER_KEYS.includes(requested) ? requested : 'all'

  const entryNameById = new Map(entries.map((e) => [e.id, e.name]))
  const peersByMatch = new Map<number, PeerPrediction[]>()
  for (const p of allPreds) {
    const list = peersByMatch.get(p.matchId) ?? []
    list.push({
      name: entryNameById.get(p.entryId) ?? '—',
      home: p.homeGoals,
      away: p.awayGoals,
    })
    peersByMatch.set(p.matchId, list)
  }

  const visible = applyFilter(matches, filter, todayKey)
  const liveCount = matches.filter((m) => m.status === 'LIVE').length

  const groups = new Map<string, MatchWithTeams[]>()
  for (const match of visible) {
    const key = dayKey(match.kickoffUtc)
    const list = groups.get(key) ?? []
    list.push(match)
    groups.set(key, list)
  }

  return (
    <div className="flex flex-col gap-4">
      <AutoRefresh seconds={60} />

      {missingAwards > 0 && (
        <Link
          href="/premios"
          className="flex items-center justify-between gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 transition-colors hover:bg-amber-500/15"
        >
          <span>
            {t('matches.awardsReminder', {
              n: missingAwards,
              faltan: missingAwards === 1 ? 'falta' : 'faltan',
              premios:
                lang === 'es'
                  ? missingAwards === 1
                    ? 'premio'
                    : 'premios'
                  : missingAwards === 1
                    ? 'award'
                    : 'awards',
            })}
          </span>
          <span className="shrink-0 font-bold">{t('matches.awardsReminder.cta')}</span>
        </Link>
      )}

      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">{t('matches.title')}</h1>
        <nav aria-label="Filtros" className="flex flex-wrap gap-2">
          {FILTER_KEYS.map((key) => (
            <Link
              key={key}
              href={`/partidos?filtro=${key}`}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                filter === key
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                  : 'border-slate-700 text-slate-300 hover:border-slate-500'
              )}
            >
              {FILTER_LABELS[key]}
              {key === 'live' && liveCount > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-slate-950">
                  {liveCount}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </header>

      {matches.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-700 p-8 text-center">
          <p className="text-4xl" aria-hidden>
            📡
          </p>
          <h2 className="mt-3 text-lg font-bold">{t('matches.empty.title')}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
            {t('matches.empty.body')}{' '}
            {user.isSuperadmin ? (
              <>
                {t('matches.empty.adminCta', { link: '' })}
                <Link href="/admin" className="font-semibold text-emerald-400 hover:underline">
                  {t('matches.empty.adminLink')}
                </Link>
              </>
            ) : (
              t('matches.empty.playerCta')
            )}
          </p>
        </section>
      ) : visible.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
          {t('matches.noneForFilter')}
        </section>
      ) : (
        Array.from(groups.entries()).map(([key, dayMatches]) => (
          <section key={key} className="flex flex-col gap-2">
            <h2 className="sticky top-14 z-30 -mx-1 bg-slate-950/90 px-1 py-1.5 text-sm font-bold text-slate-300 backdrop-blur">
              {dayLabel(dayMatches[0].kickoffUtc, lang)}
            </h2>
            <div className="flex flex-col gap-2.5">
              {dayMatches.map((match) => {
                const kickoff = Date.parse(match.kickoffUtc)
                const started = now >= kickoff
                const locked = now >= kickoff - PREDICTION_LOCK_MS
                const pred = myPreds.get(match.id)
                const hasResult = match.homeGoals !== null && match.awayGoals !== null
                return (
                  <MatchCard
                    key={match.id}
                    match={match}
                    myPrediction={pred ? { home: pred.homeGoals, away: pred.awayGoals } : null}
                    breakdown={
                      hasResult && match.status !== 'SCHEDULED'
                        ? scoreMatchSafe(
                            pred ? { home: pred.homeGoals, away: pred.awayGoals } : null,
                            { home: match.homeGoals as number, away: match.awayGoals as number },
                            match.stage,
                            DEFAULT_RULES
                          )
                        : null
                    }
                    started={started}
                    locked={locked}
                    peerPredictions={started ? (peersByMatch.get(match.id) ?? []) : []}
                    t={t}
                  />
                )
              })}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
