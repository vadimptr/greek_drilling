import type { Level, Persona, Scenario, TimeOfDay } from './scenario.ts'

export interface ScenarioGenerator {
  generate(level: Level, recentGoals: string[], time?: TimeOfDay): Promise<Scenario>
}

export interface FactMatcher {
  match(speaker: string, lines: { role: string; text: string }[], facts: { id: string; text: string }[]): Promise<string[]>
}

export interface LevelIssue {
  index: number
  reason_ru: string
  note_en: string
}

export interface LevelChecker {
  check(level: string, lines: string[]): Promise<LevelIssue[]>
}

export interface Translator {
  toRussian(greek: string): Promise<string>
  toGreek(russian: string): Promise<string>
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
