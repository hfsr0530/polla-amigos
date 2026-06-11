'use client'

import { useRouter } from 'next/navigation'
import { useLang } from '@/shared/i18n/I18nProvider'
import { cn } from '@/shared/lib/utils'

// Alterna ES/EN guardando la preferencia en una cookie de un año
export function LangToggle() {
  const router = useRouter()
  const lang = useLang()

  function setLang(next: 'es' | 'en') {
    document.cookie = `polla_lang=${next};path=/;max-age=31536000;samesite=lax`
    router.refresh()
  }

  return (
    <div
      className="flex items-center rounded-lg border border-slate-700 p-0.5 text-[11px] font-bold"
      role="group"
      aria-label="Idioma / Language"
    >
      {(['es', 'en'] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => setLang(value)}
          aria-pressed={lang === value}
          className={cn(
            'rounded-md px-1.5 py-0.5 uppercase transition-colors',
            lang === value ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
          )}
        >
          {value}
        </button>
      ))}
    </div>
  )
}
