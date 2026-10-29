export type Lang = 'el' | 'en' | 'ru'

export const LANGS: Lang[] = ['el', 'en', 'ru']

export const LANG_NAMES: Record<Lang, string> = { el: 'Ελληνικά', en: 'English', ru: 'Русский' }

export const CITY_NAMES: Record<Lang, string> = { el: 'Μυθόπολη', en: 'Mythmouth', ru: 'Мифоград' }

export const CITY_NAME = CITY_NAMES.el
export const CITY_PATH = '/mythopoli'

export const isLang = (v: unknown): v is Lang => v === 'el' || v === 'en' || v === 'ru'

export function otherLang(learn: Lang, preferred: Lang = 'ru'): Lang {
  if (preferred !== learn) return preferred
  return learn === 'en' ? 'ru' : 'en'
}
