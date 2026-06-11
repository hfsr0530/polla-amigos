import { redirect } from 'next/navigation'
import { getSession } from '@/features/auth/session'
import { getUserMemberships, listUsers } from '@/features/auth/service'
import { countEntryMembers, listEntriesWithMemberAccounts } from '@/features/entries/service'
import { listInviteStatuses } from '@/features/invites/service'
import { getPolla, listPollasWithStats } from '@/features/pollas/service'
import { getAllMatches, getAllTeams } from '@/features/matches/service'
import { getAllAwardPicks, getAwardResults, isPickCorrect } from '@/features/awards/service'
import { countPlayers, listPlayers, playerLabel } from '@/features/players/service'
import { getSyncStatus } from '@/features/livescore/sync'
import { SyncPanel } from '@/features/admin/components/SyncPanel'
import { InvitesPanel, type InviteView } from '@/features/admin/components/InvitesPanel'
import { PollasPanel, type PollaView } from '@/features/admin/components/PollasPanel'
import { ManualResultForm } from '@/features/admin/components/ManualResultForm'
import { OfficialAwardsPanel } from '@/features/admin/components/OfficialAwardsPanel'
import { PickOverrideButtons } from '@/features/admin/components/PickOverrideButtons'
import { ParticipantsPanel } from '@/features/admin/components/ParticipantsPanel'
import { getT } from '@/shared/i18n/server'
import type { TKey } from '@/shared/i18n/dictionary'
import { PLAYER_AWARDS, type AwardKey } from '@/shared/types/domain'

export const dynamic = 'force-dynamic'

const RECENT_WINDOW_MS = 48 * 60 * 60 * 1000
const UPCOMING_WINDOW_MS = 24 * 60 * 60 * 1000

export default async function AdminPage() {
  const user = await getSession()
  if (!user) redirect('/login')
  if (!user.isPollaAdmin && !user.isSuperadmin) redirect('/partidos')

  const [t, polla, inviteStatuses, entries, users, allPicks, results] = await Promise.all([
    getT(),
    getPolla(user.pollaId),
    listInviteStatuses(user.pollaId),
    listEntriesWithMemberAccounts(user.pollaId),
    listUsers(user.pollaId),
    getAllAwardPicks(user.pollaId),
    getAwardResults(),
  ])
  const superIntroParts = t('admin.superIntro').split('{b}')
  const invites: InviteView[] = inviteStatuses.map((i) => ({
    code: i.code,
    kind: i.kind,
    label: i.label,
    revoked: i.revoked,
    slotsLeft: i.slotsLeft,
    entryName: i.entryName,
    usedBy: i.usedBy,
  }))
  const entryNameById = new Map(entries.map((e) => [e.id, e.name]))

  // Datos del torneo: solo el superadmin los gestiona
  const [status, matches, teams, pollaStats, myMemberships, players, playersCount] =
    user.isSuperadmin
      ? await Promise.all([
          getSyncStatus(),
          getAllMatches(),
          getAllTeams(),
          listPollasWithStats(),
          getUserMemberships(user.id),
          listPlayers(),
          countPlayers(),
        ])
      : [null, [], [], [], await getUserMemberships(user.id), [], 0]
  const playerOptions = players.map((p) => ({ id: p.id, label: playerLabel(p) }))
  const playerLabelById = new Map(playerOptions.map((p) => [p.id, p.label]))
  const pollas: PollaView[] = pollaStats.map((p) => ({
    id: p.id,
    name: p.name,
    adminName: p.adminName,
    entryCount: p.entryCount,
    userCount: p.userCount,
    pendingAdminCode: p.pendingAdminCode,
  }))

  const now = Date.now()
  const recent = matches.filter((m) => {
    const t = Date.parse(m.kickoffUtc)
    return t >= now - RECENT_WINDOW_MS && t <= now + UPCOMING_WINDOW_MS
  })
  const others = matches.filter((m) => !recent.includes(m))

  const currentResults: Partial<
    Record<AwardKey, { teamId: number | null; playerLabel: string | null }>
  > = {}
  for (const [award, r] of results) {
    currentResults[award] = {
      teamId: r.teamId,
      playerLabel: r.playerId
        ? (playerLabelById.get(r.playerId) ?? r.playerName)
        : r.playerName,
    }
  }

  const renderResultRow = (m: (typeof matches)[number]) => (
    <li key={m.id} className="border-b border-slate-800/60 py-2 last:border-0">
      <ManualResultForm
        matchId={m.id}
        homeName={m.homeTeam?.name ?? m.homeLabel ?? 'Por definir'}
        awayName={m.awayTeam?.name ?? m.awayLabel ?? 'Por definir'}
        homeGoals={m.homeGoals}
        awayGoals={m.awayGoals}
        status={m.status}
        locked={m.resultLocked}
      />
    </li>
  )

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">{t('admin.title')}</h1>
        <p className="mt-1 text-sm text-slate-400">
          {user.isSuperadmin ? (
            <>
              {superIntroParts[0]}
              <strong className="text-amber-300">{t('admin.superIntroBold')}</strong>
              {superIntroParts[1]}
            </>
          ) : (
            t('admin.pollaIntro', { name: polla?.name ?? '' })
          )}
        </p>
      </header>

      {user.isSuperadmin && (
        <section className="rounded-2xl border border-amber-500/30 bg-slate-900/60 p-4 sm:p-5">
          <h2 className="mb-1 text-base font-bold">
            {t('admin.pollas.title', { n: pollas.length })}
          </h2>
          <p className="mb-3 text-xs text-slate-500">{t('admin.pollas.hint')}</p>
          <PollasPanel
            pollas={pollas}
            currentPollaId={user.pollaId}
            myPollaIds={myMemberships.map((m) => m.pollaId)}
          />
        </section>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
        <h2 className="mb-1 text-base font-bold">
          {t('admin.invites.title', { name: polla?.name ?? '' })}
        </h2>
        <p className="mb-3 text-xs text-slate-500">{t('admin.invites.hint')}</p>
        <InvitesPanel
          invites={invites}
          canInviteToMyEntry={(await countEntryMembers(user.entryId)) < 2}
        />
      </section>

      {user.isSuperadmin && status && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
          <h2 className="mb-3 text-base font-bold">{t('admin.sync.title')}</h2>
          <SyncPanel
            provider={status.provider}
            lastSyncAt={status.lastSyncAt}
            lastSyncCount={status.lastSyncCount}
            lastError={status.lastError}
            playersCount={playersCount}
          />
          <p className="mt-3 text-xs text-slate-500">{t('admin.sync.hint')}</p>
        </section>
      )}

      {user.isSuperadmin && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
          <h2 className="mb-1 text-base font-bold">{t('admin.results.title')}</h2>
          <p className="mb-3 text-xs text-slate-500">{t('admin.results.hint')}</p>
          {matches.length === 0 ? (
            <p className="text-sm italic text-slate-500">{t('admin.results.syncFirst')}</p>
          ) : (
            <>
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">
                {t('admin.results.recent')}
              </h3>
              {recent.length === 0 ? (
                <p className="text-sm italic text-slate-500">{t('admin.results.nothingRecent')}</p>
              ) : (
                <ul>{recent.map(renderResultRow)}</ul>
              )}
              {others.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-sky-400 hover:text-sky-300">
                    {t('admin.results.all', { n: others.length })}
                  </summary>
                  <ul className="mt-2">{others.map(renderResultRow)}</ul>
                </details>
              )}
            </>
          )}
        </section>
      )}

      {user.isSuperadmin && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
          <h2 className="mb-1 text-base font-bold">{t('admin.officialAwards.title')}</h2>
          <p className="mb-3 text-xs text-slate-500">{t('admin.officialAwards.hint')}</p>
          <OfficialAwardsPanel
            teams={teams.map((tm) => ({ id: tm.id, name: tm.name }))}
            players={playerOptions}
            current={currentResults}
          />
        </section>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
        <h2 className="mb-1 text-base font-bold">{t('admin.validate.title')}</h2>
        <p className="mb-3 text-xs text-slate-500">{t('admin.validate.hint')}</p>
        {PLAYER_AWARDS.map((award) => {
          const picks = allPicks.filter((p) => p.award === award)
          if (picks.length === 0) return null
          const result = results.get(award)
          return (
            <div key={award} className="mb-4 last:mb-0">
              <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                {t(`award.${award}` as TKey)}
                {result?.playerName && (
                  <span className="ml-2 normal-case text-amber-300">→ {result.playerName}</span>
                )}
              </h3>
              <ul className="flex flex-col gap-1.5">
                {picks.map((pick) => {
                  const auto = isPickCorrect({ ...pick, correctOverride: null }, result)
                  return (
                    <li
                      key={`${pick.entryId}-${pick.award}`}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <span className="text-slate-300">
                        {entryNameById.get(pick.entryId) ?? '—'}:{' '}
                        <strong>{pick.playerName ?? '—'}</strong>{' '}
                        <span className="text-xs text-slate-500">
                          (
                          {t('admin.validate.auto', {
                            state:
                              auto === null
                                ? t('admin.validate.pending')
                                : auto
                                  ? t('admin.validate.hit')
                                  : t('admin.validate.miss'),
                          })}
                          )
                        </span>
                      </span>
                      <PickOverrideButtons
                        entryId={pick.entryId}
                        award={pick.award}
                        current={pick.correctOverride === null ? null : pick.correctOverride === 1}
                      />
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
        {allPicks.filter((p) => (PLAYER_AWARDS as readonly string[]).includes(p.award)).length ===
          0 && <p className="text-sm italic text-slate-500">{t('admin.validate.empty')}</p>}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
        <h2 className="mb-1 text-base font-bold">
          {t('admin.people.title', { entries: entries.length, users: users.length })}
        </h2>
        <p className="mb-3 text-xs text-slate-500">{t('admin.people.hint')}</p>
        <ParticipantsPanel
          entries={entries.map((e) => ({
            id: e.id,
            name: e.name,
            kind: e.kind,
            members: e.members,
          }))}
        />
      </section>
    </div>
  )
}
