import type { GrammarState } from '../types/grammar'
import type { MockState } from '../types/mock'
import type { AppState } from './appState'
import type { Progress } from './state'

const union = (a: number[], b: number[]) => [...new Set([...a, ...b])]

function mergeProgress<P extends Progress>(local: P, remote: P): P {
  const learned = union(remote.learned, local.learned)
  const learnedSet = new Set(learned)
  const weak: Record<number, number> = {}
  for (const src of [remote.weak, local.weak]) {
    for (const [k, v] of Object.entries(src)) {
      const id = Number(k)
      if (!learnedSet.has(id)) weak[id] = Math.max(weak[id] ?? 0, v)
    }
  }
  return {
    ...remote,
    learned,
    weak,
    score: Math.max(local.score, remote.score),
    bestStreak: Math.max(local.bestStreak, remote.bestStreak),
  }
}

function mergeGrammar(local: GrammarState, remote: GrammarState): GrammarState {
  return {
    completed: union(remote.completed, local.completed),
    score: Math.max(local.score, remote.score),
    bestStreak: Math.max(local.bestStreak, remote.bestStreak),
    active: remote.active ?? local.active,
  }
}

function mergeMock(local: MockState, remote: MockState): MockState {
  const seen = new Set<string>()
  const history = [...remote.history, ...local.history]
    .filter((a) => {
      const key = `${a.date}|${a.variantId}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => a.date.localeCompare(b.date))
  return { history, nextVariant: Math.max(local.nextVariant, remote.nextVariant) }
}

export function hasProgress(s: AppState): boolean {
  const parts: Progress[] = [s.words, s.speak, s.spell, s.nouns, s.aorist]
  return (
    parts.some((p) => p.learned.length > 0 || Object.keys(p.weak).length > 0 || p.score > 0 || p.bestStreak > 0) ||
    s.grammar.completed.length > 0 ||
    s.grammar.score > 0 ||
    s.grammar.bestStreak > 0 ||
    s.grammar.active !== null ||
    s.mock.history.length > 0
  )
}

export function mergeApp(local: AppState, remote: AppState | null): AppState {
  if (remote === null) return local
  return {
    ...remote,
    words: mergeProgress(local.words, remote.words),
    grammar: mergeGrammar(local.grammar, remote.grammar),
    mock: mergeMock(local.mock, remote.mock),
    speak: mergeProgress(local.speak, remote.speak),
    spell: mergeProgress(local.spell, remote.spell),
    nouns: mergeProgress(local.nouns, remote.nouns),
    aorist: mergeProgress(local.aorist, remote.aorist),
  }
}
