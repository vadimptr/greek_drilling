import type { Pos, Word } from '../types/word'

export interface WordInfo {
  title: string
  lines: string[]
}

export const POS_LABEL: Record<Pos, string> = {
  noun: 'Существительное',
  verb: 'Глагол',
  adj: 'Прилагательное',
  adv: 'Наречие',
  pron: 'Местоимение',
  prep: 'Предлог',
  conj: 'Союз',
  num: 'Числительное',
  phrase: 'Фраза',
  other: 'Служебное слово',
}

type Gender = 'm' | 'f' | 'n'

const GENDER_NOM: Record<Gender, string> = { m: 'мужской', f: 'женский', n: 'средний' }
const GENDER_GEN: Record<Gender, string> = { m: 'мужского', f: 'женского', n: 'среднего' }

const ARTICLES: Record<string, { gender: Gender | null; plural: boolean }> = {
  ο: { gender: 'm', plural: false },
  η: { gender: 'f', plural: false },
  το: { gender: 'n', plural: false },
  οι: { gender: null, plural: true },
  τα: { gender: 'n', plural: true },
}

/** Типичные окончания ед. ч. → род. Длинные раньше коротких. */
const SINGULAR_ENDINGS: [string, Gender][] = [
  ['μα', 'n'],
  ['ους', 'm'],
  ['ος', 'm'],
  ['ας', 'm'],
  ['ης', 'm'],
  ['ες', 'm'],
  ['α', 'f'],
  ['η', 'f'],
  ['ο', 'n'],
  ['ι', 'n'],
  ['υ', 'n'],
]

/** Окончания мн. ч. с артиклем οι → род. */
const PLURAL_OI_ENDINGS: [string, Gender][] = [
  ['οι', 'm'],
  ['εις', 'm'],
  ['ες', 'f'],
]

const INDECLINABLE_ADJ = new Set(['μπλε', 'γκρι', 'καφε', 'ροζ', 'μοβ', 'πορτοκαλι'])

/** Убирает ударения: «καφές» → «καφες». */
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function findEnding(word: string, table: [string, Gender][]): { text: string; gender: Gender } | null {
  const plain = stripAccents(word)
  for (const [ending, gender] of table) {
    if (plain.endsWith(ending)) return { text: ending, gender }
  }
  return null
}

function describeNoun(el: string): string[] {
  const parts = el.trim().split(/\s+/)
  const article = ARTICLES[parts[0]]
  const noun = parts[parts.length - 1]
  if (!article || parts.length < 2) {
    return ['Род и число определяются по артиклю, здесь артикль не указан.']
  }

  if (article.plural) {
    if (article.gender) {
      return [
        'Число: множественное (артикль «τα»).',
        'Род: средний — артикль «τα» во множественном числе бывает только у среднего рода.',
      ]
    }
    const ending = findEnding(noun, PLURAL_OI_ENDINGS)
    const gender = ending?.gender ?? 'm'
    return [
      'Число: множественное (артикль «οι»).',
      `Род: ${GENDER_NOM[gender]} — артикль «οι» общий для мужского и женского рода во множественном числе, ` +
        (ending
          ? `окончание -${ending.text} указывает на ${GENDER_GEN[gender]} род.`
          : 'окончание нетипичное, род нужно запомнить.'),
    ]
  }

  const gender = article.gender as Gender
  const ending = findEnding(noun, SINGULAR_ENDINGS)
  let reason = `Род: ${GENDER_NOM[gender]} — артикль «${parts[0]}».`
  if (!ending) {
    reason += ' Окончание нетипичное (часто заимствованное слово), ориентируйся на артикль.'
  } else if (ending.gender === gender) {
    reason += ` Окончание -${ending.text} типично для ${GENDER_GEN[gender]} рода.`
  } else {
    reason +=
      ` Окончание -${ending.text} обычно бывает у слов ${GENDER_GEN[ending.gender]} рода, ` +
      'но род определяет артикль — это исключение, его надо запомнить.'
  }
  return ['Число: единственное.', reason]
}

function describeAdjective(el: string): string[] {
  const plain = stripAccents(el)
  if (INDECLINABLE_ADJ.has(plain)) {
    return ['Не склоняется: одна форма для всех родов и чисел.']
  }
  if (plain.endsWith('ος')) {
    return ['Дано в мужском роде ед. ч. (-ος).', 'Женский род: -η или -α, средний: -ο.']
  }
  if (plain.endsWith('υς')) {
    return ['Дано в мужском роде ед. ч. (-ύς).', 'Женский род: -ιά, средний: -ύ.']
  }
  if (plain.endsWith('ης')) {
    return ['Дано в мужском роде ед. ч. (-ής).', 'Женский род: -ής, средний: -ές.']
  }
  if (plain.endsWith('ων')) {
    return ['Дано в мужском роде ед. ч. (-ων).', 'Женский род: -ουσα, средний: -ον.']
  }
  return ['Дано в мужском роде ед. ч.']
}

function describeVerb(el: string): string[] {
  const plain = stripAccents(el)
  if (plain.endsWith('ει')) {
    return ['Безличная форма, 3-е лицо ед. ч. настоящего времени.']
  }
  if (plain.endsWith('μαι')) {
    return ['Глагол на -μαι (отложительный), 1-е лицо ед. ч. настоящего времени («я ...»).']
  }
  return ['Словарная форма: 1-е лицо ед. ч. настоящего времени («я ...»).']
}

function describeNumeral(el: string): string[] {
  const plain = stripAccents(el)
  if (plain.endsWith('ος')) {
    return ['Порядковое числительное, склоняется как прилагательное на -ος.']
  }
  return ['Количественное числительное.']
}

export function describeWord(word: Word): WordInfo {
  const title = POS_LABEL[word.pos]
  switch (word.pos) {
    case 'noun':
      return { title, lines: describeNoun(word.el) }
    case 'adj':
      return { title, lines: describeAdjective(word.el) }
    case 'verb':
      return { title, lines: describeVerb(word.el) }
    case 'num':
      return { title, lines: describeNumeral(word.el) }
    case 'phrase':
      return { title, lines: ['Устойчивое выражение, учится целиком.'] }
    default:
      return { title, lines: [] }
  }
}
