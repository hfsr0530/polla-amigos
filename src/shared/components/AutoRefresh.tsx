'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface AutoRefreshProps {
  seconds: number
}

// Mantiene la página al día: dispara el sync (throttled en el servidor)
// y re-renderiza los server components con los datos frescos.
export function AutoRefresh({ seconds }: AutoRefreshProps) {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    async function tick() {
      try {
        await fetch('/api/live', { cache: 'no-store' })
      } catch {
        // sin conexión: lo reintenta el próximo tick
      }
      if (!cancelled) router.refresh()
    }

    const id = setInterval(tick, seconds * 1000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [router, seconds])

  return null
}
