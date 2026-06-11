'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/shared/lib/utils'
import { useT } from '@/shared/i18n/I18nProvider'
import { PollaSwitcher, type MembershipOption } from './PollaSwitcher'
import { LangToggle } from './LangToggle'

interface AppNavProps {
  displayName: string
  pollaName: string
  isAdmin: boolean
  memberships: MembershipOption[]
}

export function AppNav({ displayName, pollaName, isAdmin, memberships }: AppNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const t = useT()

  const items = [
    { href: '/partidos', label: t('nav.matches'), icon: '⚽' },
    { href: '/premios', label: t('nav.awards'), icon: '🏆' },
    { href: '/posiciones', label: t('nav.standings'), icon: '📊' },
    { href: '/reglas', label: t('nav.rules'), icon: '📜' },
    ...(isAdmin ? [{ href: '/admin', label: t('nav.admin'), icon: '🛠️' }] : []),
  ]

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* Barra superior */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <Link href="/partidos" className="flex items-center gap-2" aria-label="Polla Amigos">
              <span aria-hidden>⚽</span>
              <span className="text-base font-bold leading-tight">
                Polla <span className="text-emerald-400">Amigos</span>
              </span>
            </Link>
            <span className="flex min-w-0 flex-col leading-tight">
              {memberships.length > 1 ? (
                <PollaSwitcher memberships={memberships} />
              ) : (
                pollaName && (
                  <span className="truncate text-[11px] text-slate-400" title={pollaName}>
                    {pollaName}
                  </span>
                )
              )}
            </span>
          </div>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Principal">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  pathname.startsWith(item.href)
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <LangToggle />
            <span
              className="hidden max-w-[8rem] truncate text-sm text-slate-300 sm:inline"
              title={displayName}
            >
              {displayName}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
            >
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </header>

      {/* Barra inferior móvil */}
      <nav
        aria-label="Principal móvil"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur md:hidden"
      >
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
                pathname.startsWith(item.href) ? 'text-emerald-300' : 'text-slate-400'
              )}
            >
              <span className="text-lg leading-none" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  )
}
