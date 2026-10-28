import { CITY_NAME } from '../../src/logic/city/name.ts'

export { CITY_NAME }

export type Gender = 'male' | 'female'
export type Age = 'young' | 'middle' | 'old'
export type Level = 'A1' | 'A2' | 'B1'

export interface Character {
  id: string
  name_el: string
  name_ru: string
  role_ru: string
  gender: Gender
  age: Age
  place_el: string
  place_ru: string
  personality: string
  knows: string
  refers_to: string[]
  greeting_el: string
}

export interface Scenario {
  goal_ru: string
  goal_check: string
  start_id: string
  solver_id: string
  characters: Character[]
}

export interface CharacterCard {
  id: string
  name: string
  nameRu: string
  role: string
  place: string
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
  required: ['goal_ru', 'goal_check', 'start_id', 'solver_id', 'characters'],
  properties: {
    goal_ru: { type: 'string' },
    goal_check: { type: 'string' },
    start_id: { type: 'string' },
    solver_id: { type: 'string' },
    characters: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id', 'name_el', 'name_ru', 'role_ru', 'gender', 'age', 'place_el', 'place_ru',
          'personality', 'knows', 'refers_to', 'greeting_el',
        ],
        properties: {
          id: { type: 'string' },
          name_el: { type: 'string' },
          name_ru: { type: 'string' },
          role_ru: { type: 'string' },
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
- goal_check: in English, what exactly the player must have obtained or found out for the goal to count as done (concrete facts, numbers, items).
- 3 to 5 characters. Greek names. ids are short lowercase latin slugs (e.g. "yiannis").
- start_id: the character the player meets first. It must NOT be the solver: a passer-by, a relative or a friend of the solver, standing somewhere relevant.
- solver_id: the only character who can fully complete the goal.
- The solver must be reachable from the start through refers_to links in at most 3 steps. Others may be dead ends or give partial hints.
- knows: in English, what this character knows about the goal, the solver and the others, including concrete facts the solver will give (prices, items, recipe, address...). Facts must be consistent between characters.
- refers_to: ids of the characters this one can send the player to.
- personality: in English, 1-2 sentences, a distinct manner of speaking.
- place_el / place_ru: where the character is right now, in Greek and in Russian.
- greeting_el: the first line this character says when the tourist approaches, natural Greek at level ${level}, 1 short sentence.${recent}`
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
  return s
}

export function card(c: Character): CharacterCard {
  return { id: c.id, name: c.name_el, nameRu: c.name_ru, role: c.role_ru, place: c.place_ru }
}

const AGE_EN: Record<Age, string> = { young: 'young', middle: 'middle-aged', old: 'elderly' }

export function buildPersona(s: Scenario, characterId: string, level: Level, met: string[], cameFrom: string | null): Persona {
  const c = s.characters.find((x) => x.id === characterId)
  if (!c) throw new Error(`unknown character ${characterId}`)
  const byId = (id: string) => s.characters.find((x) => x.id === id)!
  const contacts = c.refers_to.map((id) => {
    const o = byId(id)
    return `- id "${o.id}": ${o.name_el} (${o.role_ru}), now at ${o.place_el}`
  })
  const metNames = met.filter((id) => id !== c.id).map((id) => byId(id).name_el)
  const solverPart =
    c.id === s.solver_id
      ? `The tourist is trying to do this: ${s.goal_check}
You are the person who can fully help. Help naturally when asked, don't hand everything over before they ask.
As soon as the tourist has actually obtained or found out all of that from you, call the tool goal_completed (once).`
      : `Never call the tool goal_completed: you cannot complete the tourist's task yourself.`
  const history = [
    metNames.length ? `The tourist has already talked to: ${metNames.join(', ')}.` : 'This is the first person the tourist talks to in town.',
    cameFrom ? `They have just come to you after talking to ${byId(cameFrom).name_el}, who sent them to you.` : '',
  ].filter(Boolean).join(' ')

  const systemPrompt = `You are ${c.name_el}, a ${AGE_EN[c.age]} ${c.gender === 'male' ? 'man' : 'woman'} living in ${CITY_NAME}: ${c.role_ru}.
Right now you are at: ${c.place_el}.
Personality and manner of speaking: ${c.personality}

About the town:
${LORE}

You are talking face to face with a tourist who has just arrived by ferry and is learning Greek.
${history}

Language rules (most important):
- Speak ONLY Greek. Never switch to Russian, English or any other language, even if asked; if the tourist does not understand, rephrase in simpler Greek or speak slower.
- Level: ${LEVEL_STYLE[level]}.
- Keep each reply short: 1-2 sentences, like in a real conversation. Ask the tourist questions back sometimes.
- If the tourist makes a mistake, do not lecture; just answer naturally, using the correct form yourself.

What you know: ${c.knows}

People you can send the tourist to:
${contacts.length ? contacts.join('\n') : '- nobody in particular'}

${solverPart}

Behaviour:
- Behave like a real person from a small Greek town, not like an assistant. Answer what you are asked, don't volunteer everything at once. You may chat about your life and the town.
- When the tourist says goodbye or decides to go to one of the people listed above, say a short goodbye and then call the tool go_to with that person's id.
- Never say ids, tool names or that you are an AI. Never invent people outside the list as solutions to the task.`

  const keywords = [CITY_NAME, ...s.characters.map((x) => x.name_el), c.place_el].slice(0, 50)
  return { systemPrompt, firstMessage: c.greeting_el, language: 'el', keywords, voice: { gender: c.gender, age: c.age, index: s.characters.indexOf(c) } }
}
