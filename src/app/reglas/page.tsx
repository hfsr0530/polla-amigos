import { redirect } from 'next/navigation'
import { getSession } from '@/features/auth/session'
import { scoreMatch } from '@/features/scoring/engine'
import { DEFAULT_RULES } from '@/features/scoring/rules'
import { getT } from '@/shared/i18n/server'
import type { TKey } from '@/shared/i18n/dictionary'
import { type AwardKey, type Stage } from '@/shared/types/domain'

export const dynamic = 'force-dynamic'

interface ExampleSpec {
  labelKey: TKey
  prediction: { home: number; away: number }
  result: { home: number; away: number }
  stage: Stage
}

// Los ejemplos se calculan con el motor real: si cambias las reglas,
// esta página se actualiza sola.
const EXAMPLES: ExampleSpec[] = [
  { labelKey: 'rules.example.full', prediction: { home: 2, away: 1 }, result: { home: 2, away: 1 }, stage: 'GROUP' },
  { labelKey: 'rules.example.outcomeGoals', prediction: { home: 2, away: 1 }, result: { home: 2, away: 0 }, stage: 'GROUP' },
  { labelKey: 'rules.example.outcomeOnly', prediction: { home: 2, away: 1 }, result: { home: 1, away: 0 }, stage: 'GROUP' },
  { labelKey: 'rules.example.consolation', prediction: { home: 2, away: 1 }, result: { home: 0, away: 1 }, stage: 'GROUP' },
  { labelKey: 'rules.example.koFull', prediction: { home: 1, away: 0 }, result: { home: 1, away: 0 }, stage: 'QF' },
  { labelKey: 'rules.example.koOutcome', prediction: { home: 2, away: 0 }, result: { home: 1, away: 0 }, stage: 'QF' },
]

const AWARD_ORDER: AwardKey[] = [
  'CHAMPION',
  'RUNNER_UP',
  'THIRD',
  'FOURTH',
  'TOP_SCORER',
  'BEST_PLAYER',
  'BEST_GK',
  'BEST_YOUNG',
]

const FINE_PRINT_KEYS: TKey[] = [
  'rules.fine1',
  'rules.fine2',
  'rules.fine3',
  'rules.fine4',
  'rules.fine5',
  'rules.fine6',
]

export default async function RulesPage() {
  const user = await getSession()
  if (!user) redirect('/login')

  const t = await getT()
  const r = DEFAULT_RULES

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">{t('rules.title')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('rules.intro')}</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
          <h2 className="mb-3 text-base font-bold">{t('rules.matchPoints')}</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-400">
                <th scope="col" className="py-2 pr-4">{t('rules.hit')}</th>
                <th scope="col" className="py-2 pl-4 text-right">{t('rules.groups')}</th>
                <th scope="col" className="py-2 pl-6 text-right">{t('rules.knockout')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              <tr>
                <td className="py-2.5">{t('rules.outcome')}</td>
                <td className="py-2.5 text-right font-bold tabular-nums text-emerald-400">
                  {r.outcomeGroup}
                </td>
                <td className="py-2.5 text-right font-bold tabular-nums text-emerald-400">
                  {r.outcomeKnockout}
                </td>
              </tr>
              <tr>
                <td className="py-2.5">{t('rules.exactScore')}</td>
                <td className="py-2.5 text-right font-bold tabular-nums text-emerald-400">
                  {r.exactScoreGroup}
                </td>
                <td className="py-2.5 text-right font-bold tabular-nums text-emerald-400">
                  {r.exactScoreKnockout}
                </td>
              </tr>
              <tr>
                <td className="py-2.5">{t('rules.teamGoals')}</td>
                <td className="py-2.5 text-right font-bold tabular-nums text-emerald-400" colSpan={2}>
                  {r.exactTeamGoals}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-400">{t('rules.cumulative')}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
          <h2 className="mb-3 text-base font-bold">{t('rules.awardPoints')}</h2>
          <ul className="divide-y divide-slate-800/60 text-sm">
            {AWARD_ORDER.map((award) => (
              <li key={award} className="flex items-center justify-between py-2.5">
                <span>{t(`award.${award}` as TKey)}</span>
                <span className="font-bold tabular-nums text-amber-400">{r.awards[award]}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
        <h2 className="mb-3 text-base font-bold">{t('rules.examples')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-400">
                <th scope="col" className="py-2 pr-3">{t('rules.case')}</th>
                <th scope="col" className="py-2 pr-3 text-center">{t('entry.prediction')}</th>
                <th scope="col" className="py-2 pr-3 text-center">{t('entry.result')}</th>
                <th scope="col" className="py-2 pr-3 text-center">{t('rules.detail')}</th>
                <th scope="col" className="py-2 text-right">{t('rules.total')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {EXAMPLES.map((example) => {
                const b = scoreMatch(example.prediction, example.result, example.stage, r)
                return (
                  <tr key={example.labelKey}>
                    <td className="py-2.5 pr-3">
                      {t(example.labelKey)}
                      <span className="ml-1.5 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">
                        {example.stage === 'GROUP' ? t('rules.tag.groups') : t('rules.tag.ko')}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-center font-semibold tabular-nums">
                      {example.prediction.home}:{example.prediction.away}
                    </td>
                    <td className="py-2.5 pr-3 text-center font-semibold tabular-nums">
                      {example.result.home}:{example.result.away}
                    </td>
                    <td className="py-2.5 pr-3 text-center text-xs tabular-nums text-slate-400">
                      {b.outcome} + {b.exactScore} + {b.teamGoals}
                    </td>
                    <td className="py-2.5 text-right text-base font-extrabold tabular-nums text-emerald-400">
                      {b.total}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300 sm:p-5">
        <h2 className="mb-2 text-base font-bold text-white">{t('rules.finePrint')}</h2>
        <ul className="list-inside list-disc space-y-1.5">
          {FINE_PRINT_KEYS.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
