import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ProviderError } from './providers.ts'
import type { Character, Scenario } from './scenario.ts'

export interface ImageGenerator {
  id: string
  generate(prompt: string): Promise<Buffer>
}

const STYLE = `Warm watercolor storybook illustration, soft light, gentle colors, slightly painterly details, wide cinematic 16:9 composition. Absolutely no text, letters, signs, boat names or captions anywhere in the image.
Setting: a small fictional harbour town on the Aegean coast of Greece — whitewashed houses with blue doors and shutters, bougainvillea, stone lanes, fishing boats (kaikia), the sea always nearby.`

const AGE: Record<Character['age'], string> = { young: 'young', middle: 'middle-aged', old: 'elderly' }

export function scenePrompt(c: Character): string {
  return `${STYLE}
Scene, first-person view (the viewer is not visible): ${c.name_el}, a ${AGE[c.age]} Greek ${c.gender === 'male' ? 'man' : 'woman'} — ${c.role_ru} — at ${c.place_el} (${c.place_ru}).
${c.personality} The person is in the middle of the frame, looking towards the viewer in a friendly way, the place around them is clearly visible.`
}

export class Timing {
  private avg: number
  constructor(initialMs: number) {
    this.avg = initialMs
  }
  get ms(): number {
    return Math.round(this.avg)
  }
  record(ms: number): void {
    this.avg = this.avg * 0.7 + ms * 0.3
  }
}

export type SceneState = { state: 'ready' } | { state: 'queued' } | { state: 'drawing'; elapsedMs: number; expectedMs: number } | { state: 'none' }

export class SceneStore {
  private pending = new Map<string, Promise<void>>()
  private started = new Map<string, number>()
  private queued = new Set<string>()
  readonly timing = new Timing(35_000)
  private pausedUntil = 0
  private dir: string
  private generator: ImageGenerator | null

  constructor(dir: string, generator: ImageGenerator | null) {
    this.dir = dir
    this.generator = generator
  }

  get enabled(): boolean {
    return !!this.generator && Date.now() >= this.pausedUntil
  }

  private path(gameId: string, characterId: string): string {
    return join(this.dir, gameId, `${characterId}.png`)
  }

  has(gameId: string, characterId: string): boolean {
    return existsSync(this.path(gameId, characterId))
  }

  read(gameId: string, characterId: string): Buffer | null {
    const p = this.path(gameId, characterId)
    return existsSync(p) ? readFileSync(p) : null
  }

  status(gameId: string, characterId: string): SceneState {
    if (this.has(gameId, characterId)) return { state: 'ready' }
    const key = `${gameId}/${characterId}`
    const at = this.started.get(key)
    if (at !== undefined) return { state: 'drawing', elapsedMs: Date.now() - at, expectedMs: this.timing.ms }
    if (this.queued.has(key)) return { state: 'queued' }
    return { state: 'none' }
  }

  ensureAll(gameId: string, s: Scenario): Promise<void> {
    const order = [s.start_id, ...s.characters.map((c) => c.id).filter((id) => id !== s.start_id)]
    const todo = order.filter((id) => !this.has(gameId, id) && !this.pending.has(`${gameId}/${id}`))
    if (this.enabled) todo.forEach((id) => this.queued.add(`${gameId}/${id}`))
    return todo.reduce<Promise<void>>((chain, id) => chain.then(() => this.ensure(gameId, s.characters.find((c) => c.id === id)!)), Promise.resolve())
  }

  ensure(gameId: string, c: Character): Promise<void> {
    if (!this.enabled || this.has(gameId, c.id)) return Promise.resolve()
    const key = `${gameId}/${c.id}`
    const running = this.pending.get(key)
    if (running) return running
    this.queued.delete(key)
    const startedAt = Date.now()
    this.started.set(key, startedAt)
    const job = this.generator!
      .generate(scenePrompt(c))
      .then((png) => {
        this.timing.record(Date.now() - startedAt)
        mkdirSync(join(this.dir, gameId), { recursive: true })
        writeFileSync(this.path(gameId, c.id), png)
      })
      .catch((e) => {
        if (e instanceof ProviderError && /\b(402|429)\b|paid_plan_required|quota/i.test(e.message)) this.pausedUntil = Date.now() + 15 * 60_000
        console.error(`scene ${key}:`, e instanceof Error ? e.message : e)
      })
      .finally(() => {
        this.pending.delete(key)
        this.started.delete(key)
        this.queued.delete(key)
      })
    this.pending.set(key, job)
    return job
  }
}

export function elevenLabsImages(apiKey: string, model: string, fetchImpl: typeof fetch = fetch): ImageGenerator {
  const base = 'https://api.elevenlabs.io/v1/flows/image'
  const headers = { 'xi-api-key': apiKey, 'Content-Type': 'application/json' }
  return {
    id: 'elevenlabs',
    async generate(prompt) {
      const res = await fetchImpl(base, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model_id: model, prompt, aspect_ratio: '16:9', resolution: '1K' }),
      })
      if (!res.ok) throw new ProviderError(`elevenlabs image: HTTP ${res.status} ${await res.text().catch(() => '')}`)
      const { id } = (await res.json()) as { id: string }
      for (let i = 0; i < 90; i++) {
        await new Promise((r) => setTimeout(r, 2000))
        const poll = await fetchImpl(`${base}/${id}`, { headers })
        if (!poll.ok) continue
        const g = (await poll.json()) as { status: string; content_url?: string; failure_reason?: string }
        if (g.status === 'failed') throw new ProviderError(`elevenlabs image failed: ${g.failure_reason ?? ''}`)
        if (g.status === 'completed' && g.content_url) {
          const img = await fetchImpl(g.content_url)
          return Buffer.from(await img.arrayBuffer())
        }
      }
      throw new ProviderError('elevenlabs image: timeout')
    },
  }
}

export function imageType(bytes: Buffer): string {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF') return 'image/webp'
  return 'image/png'
}

export function googleImages(apiKey: string, model: string, fetchImpl: typeof fetch = fetch): ImageGenerator {
  return {
    id: 'google',
    async generate(prompt) {
      const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } },
        }),
        signal: AbortSignal.timeout(120_000),
      })
      if (!res.ok) throw new ProviderError(`google image: HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 300)}`)
      const body = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data: string } }[] } }[] }
      const data = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data
      if (!data) throw new ProviderError('google image: no image in response')
      return Buffer.from(data, 'base64')
    },
  }
}

export function openAiImages(apiKey: string, model: string, fetchImpl: typeof fetch = fetch): ImageGenerator {
  return {
    id: 'openai',
    async generate(prompt) {
      const res = await fetchImpl('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, size: '1536x1024', quality: 'medium', output_format: 'webp', output_compression: 82, n: 1 }),
        signal: AbortSignal.timeout(180_000),
      })
      if (!res.ok) throw new ProviderError(`openai image: HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 300)}`)
      const body = (await res.json()) as { data?: { b64_json?: string }[] }
      const data = body.data?.[0]?.b64_json
      if (!data) throw new ProviderError('openai image: no image in response')
      return Buffer.from(data, 'base64')
    },
  }
}
