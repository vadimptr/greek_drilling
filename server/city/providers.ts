import type { Lang, Level, Persona, Scenario, TimeOfDay } from './scenario.ts'

export interface ScenarioGenerator {
  generate(level: Level, recentGoals: string[], time?: TimeOfDay, lang?: Lang): Promise<Scenario>
}

export interface FactMatcher {
  match(
    speaker: string,
    lines: { role: string; text: string }[],
    facts: { id: string; text: string }[],
    people: { id: string; name: string }[],
    lang?: Lang,
  ): Promise<{ facts: string[]; people: string[] }>
}

export interface LevelIssue {
  index: number
  reason: string
  note_en: string
}

export interface LevelChecker {
  check(level: string, lines: string[], lang?: Lang, hint?: Lang): Promise<LevelIssue[]>
}

export interface Translator {
  translate(text: string, to: Lang, from?: Lang): Promise<string>
  translateMany(texts: string[], to: Lang): Promise<string[]>
}

export interface VoiceSession {
  provider: string
  connection: Record<string, unknown>
}

export interface VoiceProvider {
  id: string
  open(persona: Persona): Promise<VoiceSession>
}

export class ProviderError extends Error {}
