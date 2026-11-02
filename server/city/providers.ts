import type { Meter, Usage } from './costs.ts'
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
    meter?: Meter,
  ): Promise<{ facts: string[]; people: string[] }>
}

export interface LevelIssue {
  index: number
  reason: string
  note_en: string
}

export interface LevelChecker {
  check(level: string, lines: string[], lang?: Lang, hint?: Lang, meter?: Meter): Promise<LevelIssue[]>
}

export interface Translator {
  translate(text: string, to: Lang, from?: Lang): Promise<string>
  translateMany(texts: string[], to: Lang): Promise<string[]>
}

export interface SpeechProvider {
  transcribe(audio: Buffer, type: string, lang: Lang): Promise<{ text: string; seconds: number }>
  speak(text: string, voice: Persona['voice'], speed?: number): Promise<{ audio: Buffer; chars: number }>
}

export interface ToolCall {
  name: string
  input: Record<string, unknown>
}

export interface TalkReply {
  text: string
  tools: ToolCall[]
  usage: Usage[]
}

export interface Talker {
  reply(system: string, lines: { role: 'user' | 'agent'; text: string }[]): Promise<TalkReply>
}

export class ProviderError extends Error {}
