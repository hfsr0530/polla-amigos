'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/shared/lib/utils'
import { useApiError, useT } from '@/shared/i18n/I18nProvider'

type Mode = 'login' | 'register'

interface InviteInfo {
  kind: 'INDIVIDUAL' | 'PAIR'
  label: string | null
  entryName: string | null
  joiningExisting: boolean
}

interface AuthCardProps {
  /** false solo cuando aún no existe ninguna cuenta (bootstrap del superadmin) */
  needsInvite: boolean
  /** Código que viene del link de invitación */
  initialCode?: string
  defaultMode?: Mode
}

export function AuthCard({ needsInvite, initialCode, defaultMode = 'login' }: AuthCardProps) {
  const router = useRouter()
  const t = useT()
  const apiError = useApiError()
  const [mode, setMode] = useState<Mode>(defaultMode)
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [pin, setPin] = useState('')
  const [code, setCode] = useState(initialCode ?? '')
  const [pairName, setPairName] = useState('')
  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Valida el código en vivo para saber si es de pareja (y pedir nombre de equipo)
  useEffect(() => {
    const trimmed = code.trim()
    if (mode !== 'register' || trimmed.length < 6) {
      setInvite(null)
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/invites/${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        })
        const data = (await res.json()) as { ok: boolean } & InviteInfo
        setInvite(data.ok ? data : null)
      } catch {
        setInvite(null)
      }
    }, 350)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [code, mode])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const body =
        mode === 'login'
          ? { username, pin }
          : {
              username,
              displayName,
              pin,
              inviteCode: needsInvite ? code.trim() : undefined,
              pairName: pairName.trim() || undefined,
            }
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as { ok: boolean; error?: string }
      if (!data.ok) {
        setError(data.error ? apiError(data.error) : t('login.genericError'))
        return
      }
      router.push('/partidos')
      router.refresh()
    } catch {
      setError(t('login.connectionError'))
    } finally {
      setLoading(false)
    }
  }

  const showPairFields = mode === 'register' && needsInvite && invite?.kind === 'PAIR'

  const inputClasses =
    'w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-colors'

  return (
    <section className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
      <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-800/70 p-1" role="tablist">
        {(
          [
            ['login', t('login.enter')],
            ['register', t('login.register')],
          ] as Array<[Mode, string]>
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => {
              setMode(value)
              setError(null)
            }}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              mode === value ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:text-white'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {mode === 'register' && needsInvite && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-300">{t('login.inviteCode')}</span>
            <input
              className={cn(inputClasses, 'font-mono uppercase tracking-widest')}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="K7MPQ2WX"
              required
              minLength={6}
              maxLength={12}
            />
            {invite && (
              <span className="text-xs text-emerald-400">
                {invite.joiningExisting && invite.entryName
                  ? t('login.inviteJoining', { name: invite.entryName })
                  : invite.kind === 'PAIR'
                    ? t('login.invitePair')
                    : t('login.inviteIndividual')}
                {invite.label ? ` · ${invite.label}` : ''}
              </span>
            )}
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-300">{t('login.username')}</span>
          <input
            className={inputClasses}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t('login.usernamePlaceholder')}
            autoComplete="username"
            required
            minLength={3}
            maxLength={20}
          />
        </label>

        {mode === 'register' && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-300">{t('login.yourName')}</span>
            <input
              className={inputClasses}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('login.namePlaceholder')}
              autoComplete="nickname"
              required
              minLength={2}
              maxLength={40}
            />
          </label>
        )}

        {showPairFields && !invite?.joiningExisting && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-300">
              {t('login.pairName')} <span className="text-slate-500">{t('login.optional')}</span>
            </span>
            <input
              className={inputClasses}
              value={pairName}
              onChange={(e) => setPairName(e.target.value)}
              placeholder={t('login.pairNamePlaceholder')}
              maxLength={40}
            />
            <span className="text-xs text-slate-500">{t('login.pairNameHint')}</span>
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-300">{t('login.pin')}</span>
          <input
            className={inputClasses}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="••••"
            type="password"
            inputMode="numeric"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={4}
            maxLength={6}
          />
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? t('login.creating') : mode === 'login' ? t('login.enter') : t('login.createAccount')}
        </button>

        {mode === 'register' && !needsInvite && (
          <p className="text-center text-xs text-slate-500">{t('login.firstUser')}</p>
        )}
        {mode === 'register' && needsInvite && !initialCode && (
          <p className="text-center text-xs text-slate-500">{t('login.noCode')}</p>
        )}
      </form>
    </section>
  )
}
