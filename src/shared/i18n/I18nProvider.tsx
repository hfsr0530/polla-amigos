'use client'

import { createContext, useContext, useMemo } from 'react'
import { makeT, translateApiError, type Lang, type TFunc } from './dictionary'

const I18nContext = createContext<Lang>('es')

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <I18nContext.Provider value={lang}>{children}</I18nContext.Provider>
}

export function useLang(): Lang {
  return useContext(I18nContext)
}

export function useT(): TFunc {
  const lang = useLang()
  return useMemo(() => makeT(lang), [lang])
}

/** Traduce mensajes de error de la API (generados en español) si la UI está en inglés */
export function useApiError(): (error: string) => string {
  const lang = useLang()
  return (error: string) => translateApiError(error, lang)
}
