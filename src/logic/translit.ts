/**
 * Практическая транскрипция новогреческого слова русскими буквами.
 * Ударение обозначается знаком акута (U+0301) после гласной.
 */

const ACUTE = '́'

const VOWELS = new Set(['α', 'ε', 'η', 'ι', 'ο', 'υ', 'ω'])
const VOICED = new Set(['β', 'γ', 'δ', 'ζ', 'λ', 'μ', 'ν', 'ρ', 'α', 'ε', 'η', 'ι', 'ο', 'υ', 'ω'])
const FRONT = new Set(['ε', 'η', 'ι', 'υ'])

const CONSONANTS: Record<string, string> = {
  β: 'в',
  γ: 'г',
  δ: 'д',
  ζ: 'з',
  θ: 'т',
  κ: 'к',
  λ: 'л',
  μ: 'м',
  ν: 'н',
  ξ: 'кс',
  π: 'п',
  ρ: 'р',
  σ: 'с',
  ς: 'с',
  τ: 'т',
  φ: 'ф',
  χ: 'х',
  ψ: 'пс',
}

const IOTATED: Record<string, string> = { а: 'я', о: 'ё', у: 'ю', э: 'е', е: 'е', и: 'и' }

interface Letter {
  base: string
  stressed: boolean
  dieresis: boolean
}

/** Разбирает строку на буквы без диакритики, запоминая ударение и диерезис. */
function parse(text: string): Letter[] {
  const out: Letter[] = []
  for (const ch of text.normalize('NFD').toLowerCase()) {
    const code = ch.codePointAt(0) ?? 0
    if (code === 0x0301 || code === 0x0300) {
      if (out.length) out[out.length - 1].stressed = true
    } else if (code === 0x0308) {
      if (out.length) out[out.length - 1].dieresis = true
    } else if (code >= 0x0300 && code <= 0x036f) {
      // прочие комбинируемые знаки игнорируем
    } else {
      out.push({ base: ch, stressed: false, dieresis: false })
    }
  }
  return out
}

/** Гласный звук: результат («а», «и», «у»...), кол-во букв, ударность, является ли /и/. */
interface VowelSound {
  ru: string
  len: number
  stressed: boolean
  isI: boolean
}

function readVowel(l: Letter[], i: number): VowelSound | null {
  const a = l[i]
  const b = l[i + 1]
  if (!a || !VOWELS.has(a.base)) return null
  const pair = b && !a.stressed && !b.dieresis ? a.base + b.base : ''
  switch (pair) {
    case 'ου':
      return { ru: 'у', len: 2, stressed: b.stressed, isI: false }
    case 'αι':
      return { ru: 'э', len: 2, stressed: b.stressed, isI: false }
    case 'ει':
    case 'οι':
    case 'υι':
      return { ru: 'и', len: 2, stressed: b.stressed, isI: true }
    case 'αυ':
    case 'ευ':
    case 'ηυ': {
      const next = l[i + 2]
      const voiced = !next || VOICED.has(next.base)
      const first = a.base === 'α' ? 'а' : a.base === 'ε' ? 'э' : 'и'
      return { ru: first + (voiced ? 'в' : 'ф'), len: 2, stressed: b.stressed, isI: false }
    }
  }
  switch (a.base) {
    case 'α':
      return { ru: 'а', len: 1, stressed: a.stressed, isI: false }
    case 'ε':
      return { ru: 'э', len: 1, stressed: a.stressed, isI: false }
    case 'ο':
    case 'ω':
      return { ru: 'о', len: 1, stressed: a.stressed, isI: false }
    default:
      return { ru: 'и', len: 1, stressed: a.stressed, isI: true }
  }
}

function transliterateWord(word: string): string {
  const l = parse(word)
  let out = ''
  let i = 0
  let prevWasConsonant = false
  let pendingYot = false // предыдущий звук — «й», сливаем со следующей гласной

  const emitVowel = (v: VowelSound, afterConsonant: boolean) => {
    let ru = v.ru
    let stressPos = 0
    if (pendingYot) {
      const first = ru[0]
      if (first === 'э' || first === 'и') {
        // «йе», «йи» — читается однозначнее, чем «е»/«и»
        ru = 'й' + IOTATED[first] + ru.slice(1)
        stressPos = 1
      } else {
        ru = IOTATED[first] + ru.slice(1)
      }
      pendingYot = false
    } else if (afterConsonant && ru[0] === 'э') {
      ru = 'е' + ru.slice(1)
    }
    // «ё» и так всегда ударная
    if (v.stressed && ru[stressPos] !== 'ё') ru = ru.slice(0, stressPos + 1) + ACUTE + ru.slice(stressPos + 1)
    out += ru
    prevWasConsonant = false
  }

  while (i < l.length) {
    const cur = l[i]
    const next = l[i + 1]
    const v = readVowel(l, i)

    if (v) {
      // безударный /и/ перед ударной гласной → йот (παιδιά, ελιά); после согласной — мягкость
      const after = readVowel(l, i + v.len)
      if (v.isI && !v.stressed && after && after.stressed) {
        if (prevWasConsonant) out += 'ь'
        pendingYot = true
        i += v.len
        continue
      }
      emitVowel(v, prevWasConsonant)
      i += v.len
      continue
    }

    // согласные и их сочетания
    const two = cur.base + (next?.base ?? '')
    const atStart = i === 0
    if (two === 'μπ') {
      const third = l[i + 2]
      const beforeConsonant = third && !VOWELS.has(third.base)
      out += atStart ? 'б' : beforeConsonant ? 'мп' : 'мб'
      i += 2
    } else if (two === 'γχ') {
      out += 'нх'
      i += 2
    } else if (two === 'γξ') {
      out += 'нкс'
      i += 2
    } else if (two === 'ντ') {
      out += atStart ? 'д' : 'нд'
      i += 2
    } else if (two === 'γκ') {
      out += atStart ? 'г' : 'нг'
      i += 2
    } else if (two === 'γγ') {
      out += l[i + 2]?.base === 'ν' ? 'г' : 'нг'
      i += 2
    } else if (two === 'τσ') {
      out += 'ц'
      i += 2
    } else if (two === 'τζ') {
      out += 'дз'
      i += 2
    } else if (cur.base === 'γ' && next && FRONT.has(next.base)) {
      // γ перед передней гласной — /й/; сама гласная /и/ (или дифтонг ει/οι) сливается
      const fv = readVowel(l, i + 1)
      if (fv && fv.isI && !fv.stressed && readVowel(l, i + 1 + fv.len)) {
        // γι + гласная → я/ё/ю
        pendingYot = true
        i += 1 + fv.len
        continue
      }
      // γε / γι → «йе» / «йи»
      pendingYot = true
      prevWasConsonant = false
      i += 1
      continue
    } else if (cur.base === 'σ' && next && VOICED.has(next.base) && !VOWELS.has(next.base)) {
      out += 'з'
      i += 1
    } else if (CONSONANTS[cur.base]) {
      // удвоенные согласные → одна
      if (next && next.base === cur.base) i += 1
      out += CONSONANTS[cur.base]
      i += 1
    } else {
      out += cur.base
      i += 1
      prevWasConsonant = false
      continue
    }
    prevWasConsonant = true
  }
  if (pendingYot) out += 'й'
  return out
}

export function transliterate(text: string): string {
  return text
    .replace(/'\s*/g, '')
    .split(/(\s+)/)
    .map((part) => (/^\s+$/.test(part) ? part : transliterateWord(part)))
    .join('')
}
