import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ProviderError } from './providers.ts'
import { LANGS, type Character, type Lang, type Scenario } from './scenario.ts'
import { AMBIENCE_IDS, settingOf, type Ambience } from './settings.ts'

export type { Ambience }
export { AMBIENCE_IDS }

export type AmbienceKey = string

export function ambienceKey(lang: Lang, id: Ambience): AmbienceKey {
  return lang === 'el' ? id : `${lang}_${id}`
}

export function parseAmbienceKey(key: string): { lang: Lang; id: Ambience } | null {
  const m = /^(?:(en|ru)_)?([a-z_]+)$/.exec(key)
  const id = m?.[2] as Ambience | undefined
  if (!m || !id || !AMBIENCE_IDS.includes(id)) return null
  return { lang: (m[1] as Lang | undefined) ?? 'el', id }
}

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
  if (c.ambience && AMBIENCE_IDS.includes(c.ambience as Ambience)) return c.ambience as Ambience
  const fields = c as Record<string, unknown>
  const text = LANGS.flatMap((l) => [fields[`place_${l}`], fields[`role_${l}`]]).filter(Boolean).join(' ')
  return GUESS.find(([re]) => re.test(text))?.[1] ?? 'square'
}

export function ambienceKeysOf(s: Scenario): AmbienceKey[] {
  return s.characters.map((c) => ambienceKey(s.lang ?? 'el', ambienceOf(c)))
}

export interface SoundGenerator {
  generate(prompt: string): Promise<Buffer>
}

export class AmbienceStore {
  private pending = new Map<AmbienceKey, Promise<void>>()
  private pausedUntil = 0
  private dir: string
  private generator: SoundGenerator | null

  constructor(dir: string, generator: SoundGenerator | null) {
    this.dir = dir
    this.generator = generator
  }

  private path(key: AmbienceKey): string {
    return join(this.dir, `${key}.mp3`)
  }

  has(key: AmbienceKey): boolean {
    return existsSync(this.path(key))
  }

  read(key: string): Buffer | null {
    if (!parseAmbienceKey(key)) return null
    const p = this.path(key)
    return existsSync(p) ? readFileSync(p) : null
  }

  ensure(key: AmbienceKey): Promise<void> {
    const parsed = parseAmbienceKey(key)
    if (!parsed || !this.generator || Date.now() < this.pausedUntil || this.has(key)) return Promise.resolve()
    const running = this.pending.get(key)
    if (running) return running
    const job = this.generator
      .generate(`${settingOf(parsed.lang).ambience[parsed.id]}. Continuous seamless background ambience, no music, no speech.`)
      .then((mp3) => {
        mkdirSync(this.dir, { recursive: true })
        writeFileSync(this.path(key), mp3)
      })
      .catch((e) => {
        if (e instanceof ProviderError && /\b(401|402|429)\b|permission|quota/i.test(e.message)) this.pausedUntil = Date.now() + 15 * 60_000
        console.error(`ambience ${key}:`, e instanceof Error ? e.message : e)
      })
      .finally(() => this.pending.delete(key))
    this.pending.set(key, job)
    return job
  }

  ensureMany(ids: AmbienceKey[]): Promise<void> {
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
