import { cn } from '@/shared/lib/utils'
import type { Team } from '@/shared/types/domain'

interface TeamBadgeProps {
  team: Team | null
  /** Texto del fixture cuando el equipo aún no está definido (ej. "1A", "W74") */
  fallbackLabel?: string | null
  align?: 'left' | 'right'
}

export function TeamBadge({ team, fallbackLabel, align = 'left' }: TeamBadgeProps) {
  const name = team?.name ?? fallbackLabel ?? 'Por definir'
  const initials = team?.tla ?? team?.name?.slice(0, 3).toUpperCase() ?? '?'

  return (
    <span
      className={cn(
        'flex min-w-0 items-center gap-2',
        align === 'right' && 'flex-row-reverse text-right'
      )}
    >
      {team?.crestUrl ? (
        // Escudos remotos del proveedor (tamaño fijo para evitar saltos de layout)
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.crestUrl}
          alt=""
          width={24}
          height={24}
          loading="lazy"
          className="h-6 w-6 shrink-0 rounded-full bg-white/10 object-contain"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[9px] font-bold text-slate-200"
        >
          {initials}
        </span>
      )}
      <span className={cn('truncate text-sm font-medium', !team && 'italic text-slate-500')}>
        {name}
      </span>
    </span>
  )
}
