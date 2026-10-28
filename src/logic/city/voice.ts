import type { VoiceSession } from './api'

export type ToolName = 'go_to' | 'goal_completed'

export interface VoiceHandlers {
  onLine(role: 'user' | 'agent', text: string): void
  onMode(mode: 'speaking' | 'listening'): void
  onTool(name: ToolName, params: Record<string, unknown>): string
  onEnd(): void
  onError(message: string): void
}

export interface VoiceCall {
  end(): Promise<void>
}

export type VoiceConnector = (connection: Record<string, unknown>, handlers: VoiceHandlers) => Promise<VoiceCall>

const CONNECTORS: Record<string, () => Promise<VoiceConnector>> = {
  elevenlabs: () => import('./elevenlabs').then((m) => m.connect),
}

export async function startVoice(session: VoiceSession, handlers: VoiceHandlers): Promise<VoiceCall> {
  const load = CONNECTORS[session.provider]
  if (!load) throw new Error(`Неизвестный голосовой провайдер: ${session.provider}`)
  const connect = await load()
  return connect(session.connection, handlers)
}
