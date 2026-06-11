'use client'

import { useMemo, useState } from 'react'
import { cn, normalizeName } from '@/shared/lib/utils'

export interface ComboItem {
  id: number
  label: string
}

interface PlayerComboboxProps {
  id?: string
  items: ComboItem[]
  value: string
  onChange: (label: string) => void
  disabled?: boolean
  placeholder?: string
}

const MAX_RESULTS = 40

// Buscador con lista propia (reemplaza a <datalist>, que en móvil no aparece).
// Renderizamos nosotros el desplegable: funciona igual en iOS, Android y desktop.
export function PlayerCombobox({
  id,
  items,
  value,
  onChange,
  disabled,
  placeholder,
}: PlayerComboboxProps) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  // Normalizamos las etiquetas una sola vez para filtrar rápido al escribir
  const normalized = useMemo(
    () => items.map((it) => ({ it, n: normalizeName(it.label) })),
    [items]
  )

  const query = normalizeName(value)
  const matches = useMemo(() => {
    if (!query) return normalized.slice(0, MAX_RESULTS).map((x) => x.it)
    const starts: ComboItem[] = []
    const contains: ComboItem[] = []
    for (const { it, n } of normalized) {
      if (n.startsWith(query)) starts.push(it)
      else if (n.includes(query)) contains.push(it)
    }
    return [...starts, ...contains].slice(0, MAX_RESULTS)
  }, [normalized, query])

  function choose(item: ComboItem) {
    onChange(item.label)
    setOpen(false)
  }

  const inputClasses =
    'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-colors disabled:opacity-50'

  return (
    <div className="relative w-full">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        className={inputClasses}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        // Cerramos al perder foco con un respiro para que el tap en una opción
        // alcance a registrarse (la selección usa onPointerDown, más abajo)
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setActive((a) => Math.min(a + 1, matches.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter' && open && matches[active]) {
            e.preventDefault()
            choose(matches[active])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {open && matches.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-700 bg-slate-900 py-1 shadow-xl"
        >
          {matches.map((it, i) => (
            <li key={it.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                // onPointerDown selecciona antes del blur (robusto en táctil)
                onPointerDown={(e) => {
                  e.preventDefault()
                  choose(it)
                }}
                className={cn(
                  'block w-full px-3 py-2 text-left text-sm transition-colors',
                  i === active
                    ? 'bg-emerald-500/15 text-emerald-200'
                    : 'text-slate-200 hover:bg-slate-800'
                )}
              >
                {it.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
