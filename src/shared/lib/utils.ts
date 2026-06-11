// Une clases condicionales sin dependencias externas
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

// Normaliza nombres de jugadores para comparar picks contra el resultado oficial
// (minúsculas, sin acentos, espacios colapsados)
export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}
