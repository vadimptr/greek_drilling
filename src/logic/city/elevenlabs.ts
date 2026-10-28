import { Conversation, stripAudioTags, type SessionConfig } from '@elevenlabs/client'
import type { VoiceConnector } from './voice'

type Overrides = NonNullable<SessionConfig['overrides']>

export const connect: VoiceConnector = async (connection, h) => {
  const conversationToken = String(connection.conversationToken ?? '')
  const overrides = (connection.overrides ?? {}) as Overrides
  const conversation = await Conversation.startSession({
    conversationToken,
    connectionType: 'webrtc',
    overrides,
    clientTools: {
      go_to: (params: Record<string, unknown>) => h.onTool('go_to', params ?? {}),
      goal_completed: (params: Record<string, unknown>) => h.onTool('goal_completed', params ?? {}),
      reveal_fact: (params: Record<string, unknown>) => h.onTool('reveal_fact', params ?? {}),
      set_mood: (params: Record<string, unknown>) => h.onTool('set_mood', params ?? {}),
      walk_away: (params: Record<string, unknown>) => h.onTool('walk_away', params ?? {}),
      end_talk: (params: Record<string, unknown>) => h.onTool('end_talk', params ?? {}),
      introduce: (params: Record<string, unknown>) => h.onTool('introduce', params ?? {}),
    },
    onMessage: ({ message, role }) => h.onLine(role === 'user' ? 'user' : 'agent', stripAudioTags(message).replace(/\s{2,}/g, ' ').trim()),
    onModeChange: ({ mode }) => h.onMode(mode),
    onVadScore: ({ vadScore }) => h.onVoice?.(vadScore),
    onDisconnect: () => h.onEnd(),
    onError: (message) => h.onError(message),
  })
  return { end: () => conversation.endSession() }
}
