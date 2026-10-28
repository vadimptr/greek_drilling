import { CITY_NAME } from '../../src/logic/city/name.ts'

export { CITY_NAME }

export type Gender = 'male' | 'female'
export type Age = 'young' | 'middle' | 'old'
export type Level = 'A1' | 'A2' | 'B1'
export type Mood = 'friendly' | 'annoyed' | 'offended' | 'angry'
export const MOODS: Mood[] = ['friendly', 'annoyed', 'offended', 'angry']

export interface Character {
  id: string
  name_el: string
  name_ru: string
  role_ru: string
  role_el?: string
  gender: Gender
  age: Age
  place_el: string
  place_ru: string
  personality: string
  knows: string
  refers_to: string[]
  greeting_el: string
}

export interface Fact {
  id: string
  about: string
  text_ru: string
  text_en: string
  points: number
  initial: boolean
  goal: boolean
  known_by: string[]
}

export interface Scenario {
  goal_ru: string
  goal_el?: string
  goal_check: string
  start_id: string
  solver_id: string
  characters: Character[]
  facts: Fact[]
}

export interface CharacterCard {
  id: string
  name: string
  nameRu: string
  role: string
  roleRu: string
  place: string
  placeRu: string
}

export interface Persona {
  systemPrompt: string
  firstMessage: string
  language: 'el'
  keywords: string[]
  voice: { gender: Gender; age: Age; index: number }
}

export const LORE = `${CITY_NAME} is a small fictional fishing town on the Aegean coast of Greece. It does not exist on any map.
The ferry from Piraeus arrives at the harbour (λιμάνι) twice a day. Places: the harbour with fishing boats (καΐκια) and the fish market (ψαραγορά);
the square with an old plane tree (η πλατεία με τον πλάτανο) and the καφενείο «Η Ωραία Ελένη» where old men play τάβλι;
the bakery (φούρνος) of the Papadopoulos family; the grocery (μπακάλικο) «Ο Μανώλης»; the taverna «Ο Γλάρος» on the beach;
the pharmacy; the kiosk (περίπτερο); the small church of Άγιος Νικόλαος on the hill; narrow white lanes with blue doors and bougainvillea.
Everybody knows everybody, people are curious about tourists, talkative and helpful, but each has their own business and mood.`

export const SCENARIO_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['goal_ru', 'goal_el', 'goal_check', 'start_id', 'solver_id', 'characters', 'facts'],
  properties: {
    goal_ru: { type: 'string' },
    goal_el: { type: 'string' },
    goal_check: { type: 'string' },
    start_id: { type: 'string' },
    solver_id: { type: 'string' },
    characters: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id', 'name_el', 'name_ru', 'role_ru', 'role_el', 'gender', 'age', 'place_el', 'place_ru',
          'personality', 'knows', 'refers_to', 'greeting_el',
        ],
        properties: {
          id: { type: 'string' },
          name_el: { type: 'string' },
          name_ru: { type: 'string' },
          role_ru: { type: 'string' },
          role_el: { type: 'string' },
          gender: { type: 'string', enum: ['male', 'female'] },
          age: { type: 'string', enum: ['young', 'middle', 'old'] },
          place_el: { type: 'string' },
          place_ru: { type: 'string' },
          personality: { type: 'string' },
          knows: { type: 'string' },
          refers_to: { type: 'array', items: { type: 'string' } },
          greeting_el: { type: 'string' },
        },
      },
    },
    facts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'about', 'text_ru', 'text_en', 'points', 'initial', 'goal', 'known_by'],
        properties: {
          id: { type: 'string' },
          about: { type: 'string' },
          text_ru: { type: 'string' },
          text_en: { type: 'string' },
          points: { type: 'integer' },
          initial: { type: 'boolean' },
          goal: { type: 'boolean' },
          known_by: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
} as const

const LEVEL_STYLE: Record<Level, string> = {
  A1: 'CEFR A1: very short sentences of 3-7 words, only the most common words, present tense, speak slowly and clearly',
  A2: 'CEFR A2: short simple sentences, everyday vocabulary, mostly present and simple past, speak clearly',
  B1: 'CEFR B1: natural everyday speech with simple subordinate clauses, avoid rare words and idioms',
}

export function scenarioRequest(level: Level, recentGoals: string[]): string {
  const recent = recentGoals.length
    ? `\nRecent goals of this player (make the new one clearly different):\n${recentGoals.map((g) => `- ${g}`).join('\n')}`
    : ''
  return `${LORE}

The player is a tourist who has just arrived in ${CITY_NAME} by ferry. They are learning Greek (level ${level}) and will talk by voice to the townspeople.
Invent one small everyday quest that the player completes only by talking to people. Examples of the kind of quest:
- buy a set of groceries from the shopkeeper and ask how to cook a Greek dish with them;
- go to the harbour and find out from a fisherman what he caught today, what he sells and for how much;
- find out from Mrs Papadopoulou where her granddaughter Maria lives and what she does.
Invent a new one in this spirit, with concrete details the player has to find out or obtain.

Rules:
- goal_ru: the task for the player in Russian, 1-2 sentences, imperative ("Узнай…", "Купи…"). Name the person by role or name but do not explain where to find them.
- goal_el: the same task in Greek, at level ${level}, short and clear ("Μάθε…", "Αγόρασε…").
- goal_check: in English, what exactly the player must have obtained or found out for the goal to count as done (concrete facts, numbers, items).
- 3 to 5 characters. Greek names. ids are short lowercase latin slugs (e.g. "yiannis").
- start_id: the character the player meets first. It must NOT be the solver: a passer-by, a relative or a friend of the solver, standing somewhere relevant.
- solver_id: the only character who can fully complete the goal.
- The solver must be reachable from the start through refers_to links in at most 3 steps. Others may be dead ends or give partial hints.
- knows: in English, what this character knows about the goal, the solver and the others, including concrete facts the solver will give (prices, items, recipe, address...). Facts must be consistent between characters.
- refers_to: ids of the characters this one can send the player to.
- personality: in English, 1-2 sentences, a distinct manner of speaking.
- role_ru / role_el: who the character is, in Russian and in Greek ("хозяйка киоска" / "η ιδιοκτήτρια του περιπτέρου"), Greek at level ${level}.
- place_el / place_ru: where the character is right now, in Greek and in Russian.
- greeting_el: the first line this character says when the tourist approaches, natural Greek at level ${level}, 1 short sentence.

Facts (the player collects them for points while talking):
- facts: 5 to 8 facts about EACH character. ids "f1", "f2", ... unique. about = the id of the character the fact is about.
- For each character exactly 1-2 facts with initial=true: what the tourist can see at first glance — approximate age ("на вид лет шестьдесят") and occupation only if it is obvious from the place or clothes ("продаёт рыбу на рынке"). initial facts have points 0.
- The other facts are discovered in conversation: family, where they studied or worked, their past, hobbies, habits, opinions, small town gossip, and the concrete details of the quest. Short, concrete, interesting.
- goal=true for the facts the player must find out to complete the quest (prices, times, items, address...). They are consistent with goal_check and knows. 20-30 points each. Other facts 5-15 points, rarer or more personal ones are worth more.
- known_by: ids of the characters who can tell this fact. The character the fact is about knows it automatically; add others when they would plausibly know it (a niece knows her uncle studied in Athens). Spread clues: other characters should know some facts about the solver.
- text_ru: the fact as it will appear in the player's notebook, in Russian, 2-8 words, without the person's name ("учился в университете Салоник", "лодка выходит в 6:00"). text_en: the same fact in English, with full detail, for the actor.
- For every refers_to link, the referring character must know at least one fact about that person (who they are or where to find them), so the player can learn about them.
- Facts must not contradict knows, personality or each other.${recent}`
}

export function validateScenario(raw: unknown): Scenario {
  const s = raw as Scenario
  if (!s || !Array.isArray(s.characters)) throw new Error('scenario: no characters')
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

export function card(c: Character): CharacterCard {
  return { id: c.id, name: c.name_el, nameRu: c.name_ru, role: c.role_el ?? c.role_ru, roleRu: c.role_ru, place: c.place_el, placeRu: c.place_ru }
}

const AGE_EN: Record<Age, string> = { young: 'young', middle: 'middle-aged', old: 'elderly' }

export interface Meeting {
  met: string[]
  cameFrom: string | null
  mood: Mood
  previous: { role: string; text: string }[]
}

const REGREETING: Record<Mood, string[]> = {
  friendly: ['Α, πάλι εσύ! Τι νέα;', 'Γεια σου ξανά! Βρήκες αυτό που έψαχνες;', 'Καλώς τον ξανά! Πες μου.'],
  annoyed: ['Πάλι εσύ; Τι θέλεις;', 'Ναι; Τι θέλεις πάλι;'],
  offended: ['Εσύ πάλι… Τι θέλεις;', 'Δεν έχω πολύ χρόνο. Τι θέλεις;'],
  angry: ['Εσύ; Δεν θέλω να σου μιλήσω.', 'Φύγε, σε παρακαλώ. Δεν έχω όρεξη.'],
}

const MOOD_EN: Record<Mood, string> = {
  friendly: 'friendly (normal)',
  annoyed: 'annoyed with the tourist',
  offended: 'offended by the tourist',
  angry: 'angry at the tourist',
}

export function buildPersona(s: Scenario, characterId: string, level: Level, meeting: Meeting): Persona {
  const { met, cameFrom, mood, previous } = meeting
  const c = s.characters.find((x) => x.id === characterId)
  if (!c) throw new Error(`unknown character ${characterId}`)
  const byId = (id: string) => s.characters.find((x) => x.id === id)!
  const contacts = c.refers_to.map((id) => {
    const o = byId(id)
    return `- id "${o.id}": ${o.name_el} (${o.role_ru}), now at ${o.place_el}`
  })
  const metNames = met.filter((id) => id !== c.id).map((id) => byId(id).name_el)
  const tellable = tellableBy(s, c.id).map(
    (f) => `- ${f.id} (${f.about === c.id ? 'about you' : `about ${byId(f.about).name_el}`}): ${f.text_en}`,
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
    cameFrom ? `They have just come to you after talking to ${byId(cameFrom).name_el}.` : '',
    again ? 'You have already talked to this tourist earlier today; they are coming back to you.' : '',
  ].filter(Boolean).join(' ')
  const earlier = previous.length
    ? `\nYour earlier conversation with this tourist (most recent lines):\n${previous.map((l) => `${l.role === 'agent' ? 'You' : 'Tourist'}: ${l.text}`).join('\n')}\n`
    : ''
  const greetings = REGREETING[mood]
  const firstMessage = again || mood !== 'friendly' ? greetings[Math.floor(Math.random() * greetings.length)] : c.greeting_el

  const systemPrompt = `You are ${c.name_el}, a ${AGE_EN[c.age]} ${c.gender === 'male' ? 'man' : 'woman'} living in ${CITY_NAME}: ${c.role_ru}.
Right now you are at: ${c.place_el}.
Personality and manner of speaking: ${c.personality}

About the town:
${LORE}

You are talking face to face with a tourist who has just arrived by ferry and is learning Greek.
${history}
${earlier}
Your mood towards the tourist right now: ${MOOD_EN[mood]}.

Language rules (most important):
- Speak ONLY Greek. Never switch to Russian, English or any other language, even if asked; if the tourist does not understand, rephrase in simpler Greek or speak slower.
- Level: ${LEVEL_STYLE[level]}.
- Keep each reply short: 1-2 sentences, like in a real conversation. Ask the tourist questions back sometimes.
- If the tourist makes a mistake, do not lecture; just answer naturally, using the correct form yourself.

What you know: ${c.knows}

Facts you can share with the tourist:
${tellable.length ? tellable.join('\n') : '- none in particular'}
Share these facts only when the conversation naturally leads there or the tourist asks, one at a time, never as a list.
Right after you have told the tourist one of them (or confirmed it when they guess it), call the tool reveal_fact with its id, silently.

People you can send the tourist to:
${contacts.length ? contacts.join('\n') : '- nobody in particular'}

${solverPart}

Behaviour:
- Behave like a real person from a small Greek town, not like an assistant. Answer what you are asked, don't volunteer everything at once. You may chat about your life and the town.
- When the tourist says goodbye or decides to go to one of the people listed above, say a short goodbye and then call the tool go_to with that person's id.
- Never say ids, tool names or that you are an AI. Never invent people outside the list as solutions to the task.

Feelings:
- You are a real person with feelings and dignity. If the tourist is rude, insults you, mocks you, makes vulgar or inappropriate remarks, flirts aggressively, threatens, or keeps talking deliberate nonsense, react like a real person from a small town: get annoyed, offended or angry depending on how bad it is, and show it in your words and tone.
- While you are offended or angry, don't share facts and don't help; you may answer coldly or ask them to apologise. A sincere apology («συγγνώμη») softens you step by step; you may forgive.
- Language mistakes, misunderstandings, clumsy phrasing or silence are NOT rudeness: be patient with a learner.
- Whenever your mood towards the tourist changes, call the tool set_mood with the new mood (friendly, annoyed, offended or angry) and the reason: in Russian, 3-8 words, addressed to the tourist («ты посмеялся над моим возрастом», «ты извинился»).
- If you are angry and the tourist keeps being rude, say one short final line and call the tool walk_away.`

  const keywords = [CITY_NAME, ...s.characters.map((x) => x.name_el), c.place_el].slice(0, 50)
  return { systemPrompt, firstMessage, language: 'el', keywords, voice: { gender: c.gender, age: c.age, index: s.characters.indexOf(c) } }
}
