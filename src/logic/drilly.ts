export type DrillyEmotion = 'idle' | 'happy' | 'thinking' | 'celebrate' | 'miss'
export type DrillyOutfit = 'base' | 'a2' | 'b1' | 'b2' | 'master'

export const DRILLY_EMOTIONS: DrillyEmotion[] = ['idle', 'happy', 'thinking', 'celebrate', 'miss']
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
