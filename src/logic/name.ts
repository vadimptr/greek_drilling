export const NAME_MIN = 3
export const NAME_MAX = 32

const NAME_RE = /^[\p{L}\p{N}_-]+$/u

export function nameError(raw: string): string | null {
  const name = raw.trim()
  if (name.length < NAME_MIN) return `Имя — минимум ${NAME_MIN} символа`
  if (name.length > NAME_MAX) return `Имя — максимум ${NAME_MAX} символа`
  if (/\s/.test(name)) return 'Имя без пробелов'
  if (!NAME_RE.test(name)) return 'Только буквы, цифры, _ и -'
  return null
}
