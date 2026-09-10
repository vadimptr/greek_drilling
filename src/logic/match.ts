import type { Word } from '../types/word'

/** Сравнение распознанной речи с целевым словом. Все функции чистые. */

const ARTICLES = new Set(['ο', 'η', 'το', 'οι', 'τα'])

/** Нижний регистр, без ударений/диерезиса, ς→σ, без знаков препинания, одиночные пробелы. */
export function normalizeGreek(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ς/g, 'σ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Убирает ведущий определённый артикль, если за ним есть ещё слово. Вход — нормализованная строка. */
export function stripArticle(normalized: string): string {
  const i = normalized.indexOf(' ')
  if (i === -1) return normalized
  const first = normalized.slice(0, i)
  return ARTICLES.has(first) ? normalized.slice(i + 1) : normalized
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

const NUMERALS: Record<string, number> = {
  μηδεν: 0,
  ενα: 1,
  ενασ: 1,
  μια: 1,
  δυο: 2,
  τρια: 3,
  τρεισ: 3,
  τεσσερα: 4,
  τεσσερισ: 4,
  πεντε: 5,
  εξι: 6,
  επτα: 7,
  εφτα: 7,
  οκτω: 8,
  οχτω: 8,
  εννεα: 9,
  εννια: 9,
  δεκα: 10,
  εντεκα: 11,
  δωδεκα: 12,
  δεκατρια: 13,
  δεκατεσσερα: 14,
  δεκαπεντε: 15,
  δεκαεξι: 16,
  δεκαεπτα: 17,
  δεκαεφτα: 17,
  δεκαοκτω: 18,
  δεκαοχτω: 18,
  δεκαεννεα: 19,
  δεκαεννια: 19,
  εικοσι: 20,
  τριαντα: 30,
  σαραντα: 40,
  πενηντα: 50,
  εξηντα: 60,
  εβδομηντα: 70,
  ογδοντα: 80,
  ενενηντα: 90,
  εκατο: 100,
  χιλια: 1000,
}

/** Число для нормализованного количественного числительного, иначе null. */
export function numeralValue(normalized: string): number | null {
  return normalized in NUMERALS ? NUMERALS[normalized] : null
}

/** Допустимое число ошибок распознавания для цели такой длины (без пробелов). */
function tolerance(len: number): number {
  if (len >= 9) return 2
  if (len >= 5) return 1
  return 0
}

function close(heard: string, target: string): boolean {
  const h = heard.replace(/ /g, '')
  const t = target.replace(/ /g, '')
  return h === t || levenshtein(h, t) <= tolerance(t.length)
}

/**
 * Считается ли распознанный текст правильным произношением слова.
 * Принимаем с артиклем и без, одну-две оговорки для длинных слов, цифры для числительных
 * и целевое слово внутри чуть более длинной фразы (whisper любит дописать «ναι» или местоимение).
 */
export function matchesWord(heard: string, word: Word): boolean {
  const h = normalizeGreek(heard)
  if (!h) return false
  const t = normalizeGreek(word.el)
  const targets = [...new Set([t, stripArticle(t)])]
  const heards = [...new Set([h, stripArticle(h)])]

  for (const target of targets) {
    for (const hv of heards) if (close(hv, target)) return true
  }

  if (word.pos === 'num' && /^\d+$/.test(h)) {
    const value = numeralValue(stripArticle(t))
    if (value !== null && Number(h) === value) return true
  }

  const core = stripArticle(t)
  if (!core.includes(' ') && core.length > 3) {
    for (const token of h.split(' ')) if (close(token, core)) return true
  }

  return false
}
