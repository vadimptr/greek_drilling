import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ProviderError } from './providers.ts'
import type { Character } from './scenario.ts'

export const AMBIENCES = {
  harbour: 'Calm Greek harbour: gentle waves lapping against a stone pier, distant seagulls, wooden fishing boats creaking softly on their ropes',
  fish_market: 'Small open-air fish market by the sea: muffled voices of a few vendors, ice being scooped, seagulls overhead, gentle waves nearby',
  kafeneio: 'Traditional Greek village café: clicking backgammon dice and pieces, spoons in small coffee cups, soft murmur of old men talking, a chair scraping',
  square: 'Sunny small Greek town square: cicadas in a plane tree, a small fountain trickling, distant footsteps and a scooter passing far away',
  bakery: 'Small bakery shop: oven door, trays sliding, paper bags rustling, a shop bell ringing once, quiet street outside',
  shop: 'Small grocery shop: rustling bags, a cash drawer, a fridge humming, a door bell, quiet street outside',
  beach: 'Beach taverna by the sea: soft waves on pebbles, plates and glasses clinking quietly, warm breeze, distant laughter',
  hill: 'Hilltop above the sea near a small chapel: warm wind in dry grass, cicadas, goat bells far away, a distant church bell',
  lane: 'Narrow whitewashed lane in a Greek island town: footsteps on stone, a cat, birds, distant radio, a door closing',
  kiosk: 'Street kiosk on a Greek town square: rustling newspapers, a fridge humming, passing footsteps, distant traffic and cicadas',
} as const

export type Ambience = keyof typeof AMBIENCES
export const AMBIENCE_IDS = Object.keys(AMBIENCES) as Ambience[]

const GUESS: [RegExp, Ambience][] = [
  [/ψαραγορ|рыбн|рынок|ψάρ|market/i, 'fish_market'],
  [/λιμάν|προβλήτ|καΐκ|пристан|пирс|гавань|лодк|каик|harbou?r|pier|boat/i, 'harbour'],
  [/καφενε|кафе|καφέ|τάβλ/i, 'kafeneio'],
  [/φούρν|пекар|bakery/i, 'bakery'],
  [/μπακάλ|μαγαζ|бакал|магазин|лавк|shop|grocery/i, 'shop'],
  [/ταβέρν|παραλί|таверн|пляж|beach/i, 'beach'],
  [/εκκλησ|λόφ|церк|холм|chapel|church|hill/i, 'hill'],
  [/περίπτερ|киоск|kiosk/i, 'kiosk'],
  [/πλατεί|площад|square/i, 'square'],
  [/σοκάκ|δρόμ|переул|улиц|lane|street/i, 'lane'],
]

export function ambienceOf(c: Character): Ambience {
  if (c.ambience && c.ambience in AMBIENCES) return c.ambience as Ambience
  const text = `${c.place_el} ${c.place_ru} ${c.role_ru}`
  return GUESS.find(([re]) => re.test(text))?.[1] ?? 'square'
}

export interface SoundGenerator {
  generate(prompt: string): Promise<Buffer>
}

export class AmbienceStore {
  private pending = new Map<Ambience, Promise<void>>()
  private pausedUntil = 0
  private dir: string
  private generator: SoundGenerator | null

  constructor(dir: string, generator: SoundGenerator | null) {
    this.dir = dir
    this.generator = generator
  }

  private path(id: Ambience): string {
    return join(this.dir, `${id}.mp3`)
  }

  has(id: Ambience): boolean {
    return existsSync(this.path(id))
  }

  read(id: string): Buffer | null {
    if (!(id in AMBIENCES)) return null
    const p = this.path(id as Ambience)
    return existsSync(p) ? readFileSync(p) : null
  }

  ensure(id: Ambience): Promise<void> {
    if (!this.generator || Date.now() < this.pausedUntil || this.has(id)) return Promise.resolve()
    const running = this.pending.get(id)
    if (running) return running
    const job = this.generator
      .generate(`${AMBIENCES[id]}. Continuous seamless background ambience, no music, no speech.`)
      .then((mp3) => {
        mkdirSync(this.dir, { recursive: true })
        writeFileSync(this.path(id), mp3)
      })
      .catch((e) => {
        if (e instanceof ProviderError && /\b(401|402|429)\b|permission|quota/i.test(e.message)) this.pausedUntil = Date.now() + 15 * 60_000
        console.error(`ambience ${id}:`, e instanceof Error ? e.message : e)
      })
      .finally(() => this.pending.delete(id))
    this.pending.set(id, job)
    return job
  }

  ensureMany(ids: Ambience[]): Promise<void> {
    return [...new Set(ids)].reduce<Promise<void>>((chain, id) => chain.then(() => this.ensure(id)), Promise.resolve())
  }
}

export function elevenLabsSounds(apiKey: string, fetchImpl: typeof fetch = fetch): SoundGenerator {
  const request = (text: string, loop: boolean) =>
    fetchImpl('https://api.elevenlabs.io/v1/sound-generation', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, duration_seconds: 22, prompt_influence: 0.45, ...(loop ? { loop: true } : {}) }),
      signal: AbortSignal.timeout(120_000),
    })
  return {
    async generate(text) {
      let res = await request(text, true)
      if (res.status === 422 || res.status === 400) res = await request(text, false)
      if (!res.ok) throw new ProviderError(`elevenlabs sound: HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 300)}`)
      return Buffer.from(await res.arrayBuffer())
    },
  }
}
