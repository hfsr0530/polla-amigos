'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/shared/i18n/I18nProvider'

interface LocalTimeProps {
  iso: string
  mode?: 'time' | 'datetime'
}

// Renderiza la hora del kickoff en la zona horaria del navegador.
// En el servidor no la conocemos, así que hidratamos después del mount.
export function LocalTime({ iso, mode = 'time' }: LocalTimeProps) {
  const lang = useLang()
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    const date = new Date(iso)
    const formatter = new Intl.DateTimeFormat(lang, {
      ...(mode === 'datetime' ? { day: 'numeric', month: 'short' } : {}),
      hour: 'numeric',
      minute: '2-digit',
    })
    setText(formatter.format(date))
  }, [iso, mode, lang])

  return (
    <time dateTime={iso} suppressHydrationWarning className="tabular-nums">
      {text ?? '·· : ··'}
    </time>
  )
}
