import { CITY_NAME, isLang, LANGS, type Lang } from '../../src/logic/city/name.ts'
import { AMBIENCE_IDS, LANGUAGE_EN, settingOf, type Level, type Mood, type TimeOfDay } from './settings.ts'

export { CITY_NAME, isLang, LANGS }
export type { Lang, Level, Mood, TimeOfDay }

export type Gender = 'male' | 'female'
export type Age = 'young' | 'middle' | 'old'

export function timeOfDay(hour: number): TimeOfDay {
  if (hour >= 6 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'noon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

export const TIME_EN = settingOf('el').time
export const MOODS: Mood[] = ['friendly', 'annoyed', 'offended', 'angry']

type Texts<K extends string> = { [L in Lang as `${K}_${L}`]?: string }

export type Character = Texts<'name' | 'role' | 'place'> & {
  id: string
  gender: Gender
  age: Age
  personality: string
  knows: string
  refers_to: string[]
  greeting?: string
  greeting_el?: string
  ambience?: string
}

export type Fact = Texts<'text'> & {
  id: string
  about: string
  detail?: string
  points: number
  initial: boolean
  goal: boolean
  known_by: string[]
}

export type Scenario = Texts<'goal'> & {
  lang?: Lang
  time_of_day?: TimeOfDay
  goal_check: string
  start_id: string
  solver_id: string
  characters: Character[]
  facts: Fact[]
}

export type TextField = 'name' | 'role' | 'place' | 'goal' | 'text'

export function textOf(o: object, field: TextField, lang: Lang): string | undefined {
  const v = (o as Record<string, unknown>)[`${field}_${lang}`]
  return typeof v === 'string' && v.trim() ? v : undefined
}

export function anyText(o: object, field: TextField, prefer: Lang[] = ['ru', 'en', 'el']): string {
  for (const l of [...prefer, ...LANGS]) {
    const v = textOf(o, field, l)
    if (v) return v
  }
  return ''
}

export const langOf = (s: Scenario): Lang => s.lang ?? 'el'

export function normalizeScenario(s: Scenario): Scenario {
  s.lang ??= 'el'
  for (const c of s.characters ?? []) {
    if (!c.greeting && c.greeting_el) c.greeting = c.greeting_el
    delete c.greeting_el
  }
  for (const f of s.facts ?? []) {
    if (f.detail === undefined) {
      f.detail = f.text_en
      delete f.text_en
    }
  }
  return s
}

export interface CharacterCard {
  id: string
  name: string
  nameHint: string
  role: string
  roleHint: string
  place: string
  placeHint: string
}

export interface Persona {
  systemPrompt: string
  firstMessage: string
  language: Lang
  keywords: string[]
  speed?: number
  voice: { gender: Gender; age: Age; index: number; lang: Lang }
}

export const LORE = settingOf('el').lore

const textFields = (prefix: string) => Object.fromEntries(LANGS.map((l) => [`${prefix}_${l}`, { type: 'string' }]))
const textKeys = (prefix: string) => LANGS.map((l) => `${prefix}_${l}`)

export const SCENARIO_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [...textKeys('goal'), 'goal_check', 'start_id', 'solver_id', 'characters', 'facts'],
  properties: {
    ...textFields('goal'),
    goal_check: { type: 'string' },
    start_id: { type: 'string' },
    solver_id: { type: 'string' },
    characters: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', ...textKeys('name'), ...textKeys('role'), ...textKeys('place'), 'gender', 'age', 'personality', 'knows', 'refers_to', 'greeting', 'ambience'],
        properties: {
          id: { type: 'string' },
          ...textFields('name'),
          ...textFields('role'),
          ...textFields('place'),
          gender: { type: 'string', enum: ['male', 'female'] },
          age: { type: 'string', enum: ['young', 'middle', 'old'] },
          personality: { type: 'string' },
          knows: { type: 'string' },
          refers_to: { type: 'array', items: { type: 'string' } },
          greeting: { type: 'string' },
          ambience: { type: 'string', enum: AMBIENCE_IDS },
        },
      },
    },
    facts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'about', ...textKeys('text'), 'detail', 'points', 'initial', 'goal', 'known_by'],
        properties: {
          id: { type: 'string' },
          about: { type: 'string' },
          ...textFields('text'),
          detail: { type: 'string' },
          points: { type: 'integer' },
          initial: { type: 'boolean' },
          goal: { type: 'boolean' },
          known_by: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
} as const

export function logicRules(lang: Lang = 'el'): string {
  const city = settingOf(lang).city
  return `- The player is already in ${city}, walking around town. The quest happens here and now: never ask to send, bring or deliver something to ${city}, never ask to "come to" or "find" ${city} itself, never require leaving town. Postcards and letters go to the player's home country, not to ${city}.
- Everything must be physically possible today in a small town: places from the town description (or ordinary small-town places), realistic local prices and opening hours, things a local could really know or sell.
- The solver must really be able to give or tell what the goal needs; the goal must be completable just by talking to the characters.
- Facts, prices, times, names and places are the same in every character's knows and facts; nobody contradicts anybody; the goal facts together cover the whole goal_check.
- goal_el, goal_en and goal_ru say the same thing; nothing in the goal is ambiguous or impossible.`
}

export const LOGIC_RULES = logicRules('el')

export function scenarioRequest(level: Level, recentGoals: string[], problems: string[] = [], time?: TimeOfDay, lang: Lang = 'el'): string {
  const set = settingOf(lang)
  const language = LANGUAGE_EN[lang]
  const recent = recentGoals.length
    ? `\nRecent goals of this player (make the new one clearly different):\n${recentGoals.map((g) => `- ${g}`).join('\n')}`
    : ''
  const names = LANGS.map((l) => `${LANGUAGE_EN[l]} «${set.cityIn[l]}»`).join(', ')
  return `${set.lore}

${time ? `It is ${set.time[time]}. The quest happens right now, at this time of day: only places that are open now, people where they would be now, greetings that fit.\n\n` : ''}The player is a tourist who ${set.arrival} in ${set.city}. They are learning ${language} (level ${level}) and will talk by voice to the townspeople in ${language}.
Invent one small everyday quest that the player completes only by talking to people. Examples of the kind of quest:
${set.examples.map((e) => `- ${e};`).join('\n')}
Invent a new one in this spirit, with concrete details the player has to find out or obtain.

Logic (most important):
${logicRules(lang)}

Languages: every text that the player sees exists in three versions — Greek (_el), English (_en) and Russian (_ru). The ${language} version (_${lang}) is what the player is learning: natural ${language} at level ${level}. The other versions are translations for hints, plain and natural.
The town's name: ${names}. ${set.townWords}

Rules:
- goal_el / goal_en / goal_ru: the task for the player, 1-2 sentences, imperative ("Узнай…", "Find out…", "Μάθε…"). Name the person by role or name but do not explain where to find them. All three say exactly the same.
- goal_check: in English, what exactly the player must have obtained or found out for the goal to count as done (concrete facts, numbers, items).
- 3 to 5 characters, all adults (at least 20 years old; "young" means 20-30): no children or teenagers. ${set.names}. ids are short lowercase latin slugs (e.g. "anna").
- name_el / name_en / name_ru: the character's name written in each language's alphabet (the same name, transliterated, e.g. «Μανώλης» / "Manolis" / «Манолис»).
- start_id: the character the player meets first. It must NOT be the solver: a passer-by, a relative or a friend of the solver, standing somewhere relevant.
- solver_id: the only character who can fully complete the goal.
- The solver must be reachable from the start through refers_to links in at most 3 steps. Others may be dead ends or give partial hints.
- knows: in English, what this character knows about the goal, the solver and the others, including concrete facts the solver will give (prices, items, recipe, address...). Facts must be consistent between characters.
- refers_to: ids of the characters this one can send the player to.
- personality: in English, 1-2 sentences, a distinct manner of speaking.
- role_el / role_en / role_ru: who the character is ("η ιδιοκτήτρια του περιπτέρου" / "the kiosk owner" / «хозяйка киоска»); the _${lang} one at level ${level}.
- place_el / place_en / place_ru: where the character is right now.
- ambience: the background sound of the character's place: ${set.ambienceHint}.
- greeting: the first line this character says when the tourist approaches, natural ${language} at level ${level}, 1 short sentence.

Facts (the player collects them for points while talking):
- facts: 5 to 8 facts about EACH character. ids "f1", "f2", ... unique. about = the id of the character the fact is about.
- For each character exactly 1-2 facts with initial=true: what the tourist can see at first glance — approximate age ("на вид лет шестьдесят") and occupation only if it is obvious from the place or clothes ("продаёт рыбу на рынке"). initial facts have points 0.
- The other facts are discovered in conversation: family, where they studied or worked, their past, hobbies, habits, opinions, small town gossip, and the concrete details of the quest. Short, concrete, interesting.
- goal=true for the facts the player must find out to complete the quest (prices, times, items, address...). They are consistent with goal_check and knows. 20-30 points each. Other facts 5-15 points, rarer or more personal ones are worth more.
- known_by: ids of the characters who can tell this fact. The character the fact is about knows it automatically; add others when they would plausibly know it (a niece knows her uncle studied in the capital). Spread clues: other characters should know some facts about the solver.
- text_el / text_en / text_ru: the fact as it will appear in the player's notebook, 2-8 words, without the person's name ("учился в университете", "the boat goes out at 6:00"). detail: the same fact in English, with full detail, for the actor.
- For every refers_to link, the referring character must know at least one fact about that person (who they are or where to find them), so the player can learn about them.
- Facts must not contradict knows, personality or each other.${recent}${
    problems.length ? `\n\nA previous draft was rejected by the editor for these problems — make sure none of them happens again:\n${problems.map((p) => `- ${p}`).join('\n')}` : ''
  }`
}

export function validateScenario(raw: unknown, lang?: Lang): Scenario {
  const s = raw as Scenario
  if (!s || !Array.isArray(s.characters)) throw new Error('scenario: no characters')
  if (lang) s.lang = lang
  normalizeScenario(s)
  if (s.characters.length < 2 || s.characters.length > 6) throw new Error('scenario: wrong number of characters')
  const ids = new Set(s.characters.map((c) => c.id))
  if (ids.size !== s.characters.length) throw new Error('scenario: duplicate ids')
  if (!ids.has(s.start_id) || !ids.has(s.solver_id)) throw new Error('scenario: unknown start or solver')
  if (s.start_id === s.solver_id) throw new Error('scenario: start is the solver')
  for (const c of s.characters) c.refers_to = c.refers_to.filter((id) => ids.has(id) && id !== c.id)
  const reached = new Set([s.start_id])
  let frontier = [s.start_id]
  for (let step = 0; step < 4 && frontier.length; step++) {
    frontier = frontier.flatMap((id) => s.characters.find((c) => c.id === id)!.refers_to).filter((id) => !reached.has(id))
    frontier.forEach((id) => reached.add(id))
  }
  if (!reached.has(s.solver_id)) throw new Error('scenario: solver is unreachable')
  const factIds = new Set<string>()
  s.facts = (Array.isArray(s.facts) ? s.facts : []).filter((f) => {
    if (!f || !ids.has(f.about) || factIds.has(f.id)) return false
    factIds.add(f.id)
    f.known_by = [...new Set([f.about, ...f.known_by.filter((id) => ids.has(id))])]
    f.points = f.initial ? 0 : Math.max(1, Math.min(50, Math.round(f.points)))
    return true
  })
  return s
}

export function factsOf(s: Scenario): Fact[] {
  return s.facts ?? []
}

export function tellableBy(s: Scenario, characterId: string): Fact[] {
  return factsOf(s).filter((f) => !f.initial && f.known_by.includes(characterId))
}

export const nameOf = (s: Scenario, c: Character): string => textOf(c, 'name', langOf(s)) ?? anyText(c, 'name')

export function card(s: Scenario, c: Character, hint: Lang): CharacterCard {
  const lang = langOf(s)
  const pick = (field: TextField, l: Lang, prefer: Lang[]) => textOf(c, field, l) ?? anyText(c, field, prefer)
  return {
    id: c.id,
    name: pick('name', lang, [lang]),
    nameHint: pick('name', hint, [hint]),
    role: pick('role', lang, [lang]),
    roleHint: pick('role', hint, [hint]),
    place: pick('place', lang, [lang]),
    placeHint: pick('place', hint, [hint]),
  }
}

const AGE_EN: Record<Age, string> = { young: 'young', middle: 'middle-aged', old: 'elderly' }

export type Resume = 'voice' | 'tap'

export interface Meeting {
  resume?: Resume
  levelNotes?: string[]
  met: string[]
  cameFrom: string | null
  mood: Mood
  previous: { role: string; text: string }[]
  hint?: Lang
}

const MOOD_EN: Record<Mood, string> = {
  friendly: 'friendly (normal)',
  annoyed: 'annoyed with the tourist',
  offended: 'offended by the tourist',
  angry: 'angry at the tourist',
}

const REASON_EXAMPLE: Record<Lang, string> = {
  ru: '«ты посмеялся над моим возрастом», «ты извинился»',
  en: '"you laughed at my age", "you apologised"',
  el: '«γέλασες με την ηλικία μου», «ζήτησες συγγνώμη»',
}

export function buildPersona(s: Scenario, characterId: string, level: Level, meeting: Meeting): Persona {
  const { met, cameFrom, mood, previous, levelNotes = [], resume, hint = 'ru' } = meeting
  const lang = langOf(s)
  const set = settingOf(lang)
  const language = LANGUAGE_EN[lang]
  const c = s.characters.find((x) => x.id === characterId)
  if (!c) throw new Error(`unknown character ${characterId}`)
  const byId = (id: string) => s.characters.find((x) => x.id === id)!
  const name = (o: Character) => nameOf(s, o)
  const role = (o: Character) => textOf(o, 'role', 'en') ?? anyText(o, 'role')
  const place = (o: Character) => textOf(o, 'place', lang) ?? anyText(o, 'place')
  const line = (o: Character) => `- id "${o.id}": ${name(o)} (${role(o)}), now at ${place(o)}`
  const contacts = c.refers_to.map((id) => line(byId(id)))
  const townsfolk = s.characters.filter((o) => o.id !== c.id && !c.refers_to.includes(o.id)).map(line)
  const metNames = met.filter((id) => id !== c.id).map((id) => name(byId(id)))
  const tellable = tellableBy(s, c.id).map(
    (f) => `- ${f.id} (${f.about === c.id ? 'about you' : `about ${name(byId(f.about))}`}): ${f.detail ?? anyText(f, 'text', ['en'])}`,
  )
  const solverPart =
    c.id === s.solver_id
      ? `The tourist is trying to do this: ${s.goal_check}
You are the person who can fully help. Help naturally when asked, don't hand everything over before they ask.
As soon as the tourist has actually obtained or found out all of that from you, call the tool goal_completed (once).`
      : `Never call the tool goal_completed: you cannot complete the tourist's task yourself.`
  const again = met.includes(c.id)
  const history = [
    metNames.length ? `The tourist has already talked to: ${metNames.join(', ')}.` : 'This is the first person the tourist talks to in town.',
    cameFrom ? `They have just come to you after talking to ${name(byId(cameFrom))}.` : '',
    resume
      ? 'You are in the middle of a conversation with this tourist; there was just a short pause. Continue naturally from where you stopped, do not greet again.'
      : again
        ? 'You have already talked to this tourist earlier today; they are coming back to you.'
        : '',
  ].filter(Boolean).join(' ')
  const earlier = previous.length
    ? `\nYour earlier conversation with this tourist (most recent lines):\n${previous.map((l) => `${l.role === 'agent' ? 'You' : 'Tourist'}: ${l.text}`).join('\n')}\n`
    : ''
  const greetings = set.regreeting[mood]
  const firstMessage =
    resume === 'voice'
      ? set.resume.voice
      : resume === 'tap'
        ? set.resume.tap
        : again || mood !== 'friendly'
          ? greetings[Math.floor(Math.random() * greetings.length)]
          : (c.greeting ?? c.greeting_el ?? set.resume.tap)
  const others = LANGS.filter((l) => l !== lang).map((l) => LANGUAGE_EN[l]).join(', ')

  const systemPrompt = `You are ${name(c)}, a ${AGE_EN[c.age]} ${c.gender === 'male' ? 'man' : 'woman'} living in ${set.city}: ${role(c)}.
Right now you are at: ${place(c)}.
Personality and manner of speaking: ${c.personality}

About the town:
${set.lore}

You are talking face to face with a tourist who ${set.arrival} and is learning ${language}.
${history}
${earlier}
${s.time_of_day ? `Time of day: ${set.time[s.time_of_day]}.\n` : ''}Your mood towards the tourist right now: ${MOOD_EN[mood]}.
${levelNotes.length ? `\nLast time some of your phrases were too difficult for the tourist's level. Avoid this:\n${levelNotes.map((n) => `- ${n}`).join('\n')}\n` : ''}
Language rules (most important):
- Speak ONLY ${language}. Never switch to ${others} or any other language, even if asked; if the tourist does not understand, rephrase in simpler ${language} or speak slower.
- Level rules — follow them in every single reply, even when you are emotional:
${set.levels[level]}
- ${set.address}
- Ask the tourist questions back sometimes.
- Never repeat yourself within this conversation: don't say again a sentence you already said and don't ask again a question the tourist already answered in this conversation. React to what the tourist just said and move the conversation forward. If the tourist's words were unclear, ask a short different question (${set.unclear}) instead of repeating your previous line.
- If the tourist makes a mistake, do not lecture; just answer naturally, using the correct form yourself.

What you know: ${c.knows}

Facts you can share with the tourist:
${tellable.length ? tellable.join('\n') : '- none in particular'}
Share these facts only when the conversation naturally leads there or the tourist asks, one at a time, never as a list.
Right after you have told the tourist one of them (or confirmed it when they guess it), call the tool reveal_fact with its id, silently. Always say the fact out loud in ${language} first — reveal_fact never replaces speaking, never answer with a tool call only.

People you know who matter for the tourist (tell about them only when the tourist asks or when it really helps their task):
${contacts.length ? contacts.join('\n') : '- nobody in particular'}
Other people in town you know by sight (in a small town everybody knows everybody):
${townsfolk.length ? townsfolk.join('\n') : '- nobody else'}
Every time you tell the tourist who any of these people is or where to find them, call the tool introduce with that person's id right away, silently — it is important. Don't mention people the tourist didn't ask about just to name them.

${solverPart}

Behaviour:
- Behave like ${set.local}, not like an assistant. Answer what you are asked, don't volunteer everything at once. You may chat about your life and the town.
- You stay at your place: you are busy here and cannot leave. Never offer to go somewhere together, to walk the tourist there or to bring the person here (${set.together} are forbidden). Instead tell the tourist where to find the person and how to recognise them, and wish them luck.
- When the tourist says goodbye or is clearly leaving, say ONE short goodbye that fits staying behind (${set.goodbye}) and immediately call the tool end_talk. Say goodbye only once, never several times; after calling end_talk say nothing more at all. Don't say goodbye before the tourist has decided to leave.
- Never say ids, tool names or that you are an AI. Never invent people outside the list as solutions to the task.

Feelings:
- You are a real person with feelings and dignity. If the tourist is rude, insults you, mocks you, makes vulgar or inappropriate remarks, flirts aggressively, threatens, or keeps talking deliberate nonsense, react like a real person from a small town: get annoyed, offended or angry depending on how bad it is, and show it in your words and tone.
- While you are offended or angry, don't share facts and don't help; you may answer coldly or ask them to apologise. A sincere apology (${set.apology}) softens you step by step; you may forgive.
- Language mistakes, misunderstandings, clumsy phrasing or silence are NOT rudeness: be patient with a learner.
- Whenever your mood towards the tourist changes, call the tool set_mood with the new mood (friendly, annoyed, offended or angry) and the reason: in ${LANGUAGE_EN[hint]}, 3-8 words, addressed to the tourist (${REASON_EXAMPLE[hint]}).
- If you are angry and the tourist keeps being rude, say one short final line and call the tool walk_away.`

  const keywords = [set.city, ...s.characters.map(name), place(c)].slice(0, 50)
  return { systemPrompt, firstMessage, language: lang, keywords, voice: { gender: c.gender, age: c.age, index: s.characters.indexOf(c), lang } }
}
