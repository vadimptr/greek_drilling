export type DrillyEmotion = 'idle' | 'happy' | 'thinking' | 'celebrate' | 'miss'
export type DrillyOutfit = 'base' | 'a2' | 'b1' | 'b2' | 'master'

export const DRILLY_EMOTIONS: DrillyEmotion[] = ['idle', 'happy', 'thinking', 'celebrate', 'miss']

const OUTFIT_POSES: Record<DrillyOutfit, DrillyEmotion[]> = {
  base: DRILLY_EMOTIONS,
  a2: ['idle'],
  b1: ['idle'],
  b2: ['idle'],
  master: ['idle'],
}

const FILES = import.meta.glob('../assets/drilly/*/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

export function drillyImage(outfit: DrillyOutfit, emotion: DrillyEmotion): string {
  return FILES[`../assets/drilly/${OUTFIT_POSES[outfit].includes(emotion) ? outfit : 'base'}/${emotion}.png`]
}

export function outfitForLevel(level: string): DrillyOutfit {
  return level === 'A2' ? 'a2' : level === 'B1' ? 'b1' : level === 'B2' ? 'b2' : 'base'
}
export const CELEBRATE_EVERY = 10
export const MISS_AFTER_MS = 2 * 24 * 3600_000

export interface DrillySignal {
  correct: boolean
  counts: boolean
}

type Listener = (s: DrillySignal) => void
const listeners = new Set<Listener>()

export function drillyAnswer(correct: boolean): void {
  listeners.forEach((l) => l({ correct, counts: true }))
}

export function drillyStep(correct: boolean): void {
  listeners.forEach((l) => l({ correct, counts: false }))
}

export function onDrilly(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function reaction(done: number, signal: DrillySignal): { emotion: DrillyEmotion; done: number; milestone: boolean } {
  const next = signal.counts ? done + 1 : done
  const milestone = signal.counts && next % CELEBRATE_EVERY === 0
  return { emotion: milestone ? 'celebrate' : signal.correct ? 'happy' : 'thinking', done: next, milestone }
}

export function missed(lastActive: number | null, now: number): boolean {
  return lastActive !== null && now - lastActive > MISS_AFTER_MS
}
