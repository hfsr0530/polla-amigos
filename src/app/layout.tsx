import type { Metadata, Viewport } from 'next'
import { getSession } from '@/features/auth/session'
import { getUserMemberships } from '@/features/auth/service'
import { getPolla } from '@/features/pollas/service'
import { getLang } from '@/shared/i18n/server'
import { I18nProvider } from '@/shared/i18n/I18nProvider'
import { AppNav } from '@/shared/components/AppNav'
import './globals.css'

export const metadata: Metadata = {
  title: 'Polla Amigos ⚽ Mundial 2026',
  description:
    'Polla Amigos: pronósticos, puntos y resultados en vivo del Mundial 2026 entre amigos',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#020617',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, lang] = await Promise.all([getSession(), getLang()])
  const polla = user ? await getPolla(user.pollaId) : null
  const memberships = user
    ? (await getUserMemberships(user.id)).map((m) => ({
        entryId: m.entryId,
        pollaId: m.pollaId,
        pollaName: m.pollaName,
        isActive: m.isActive,
      }))
    : []

  return (
    <html lang={lang}>
      <body className="min-h-dvh bg-slate-950 text-slate-100 antialiased">
        <I18nProvider lang={lang}>
          {user && (
            <AppNav
              displayName={user.displayName}
              pollaName={polla?.name ?? ''}
              isAdmin={user.isPollaAdmin || user.isSuperadmin}
              memberships={memberships}
            />
          )}
          <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-4 sm:px-6 md:pb-10 lg:px-8">
            {children}
          </main>
        </I18nProvider>
      </body>
    </html>
  )
}
