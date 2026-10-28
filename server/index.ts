import { createServer } from 'node:http'
import { createApp } from './app.ts'
import { claudeFacts, claudeLevels, claudeScenarios, claudeTouristNotes, claudeTranslator } from './city/claude.ts'
import { dropModeratedVoices, elevenLabsVoice, parseVoices } from './city/elevenlabs.ts'
import { parseAllowed } from './city/routes.ts'
import { elevenLabsImages, googleImages, openAiImages, SceneStore } from './city/images.ts'
import { AmbienceStore, elevenLabsSounds } from './city/ambience.ts'
import { openDb } from './db.ts'
import { dirname, join } from 'node:path'

const secret = process.env.SESSION_SECRET
if (!secret || secret.length < 16) {
  console.error('SESSION_SECRET is required (16+ chars)')
  process.exit(1)
}

const env = process.env
const voiceConfig =
  env.ELEVENLABS_API_KEY && env.ELEVENLABS_AGENT_ID
    ? {
        apiKey: env.ELEVENLABS_API_KEY,
        agentId: env.ELEVENLABS_AGENT_ID,
        voices: parseVoices(env.ELEVENLABS_VOICES),
        speed: Number(env.ELEVENLABS_SPEED ?? 0.9),
      }
    : null
if (voiceConfig) {
  void dropModeratedVoices(voiceConfig).then((ids) => ids.length && console.error(`voices dropped (live moderation or missing): ${ids.join(', ')}`))
}
const city = {
  allowedUsers: parseAllowed(env.CITY_ALLOWED_USERS),
  dailyTalks: Number(env.CITY_DAILY_TALKS ?? 40),
  scenarios: env.ANTHROPIC_API_KEY ? claudeScenarios(env.ANTHROPIC_API_KEY) : null,
  facts: env.ANTHROPIC_API_KEY ? claudeFacts(env.ANTHROPIC_API_KEY) : null,
  translator: env.ANTHROPIC_API_KEY ? claudeTranslator(env.ANTHROPIC_API_KEY) : null,
  levels: env.ANTHROPIC_API_KEY ? claudeLevels(env.ANTHROPIC_API_KEY) : null,
  tourist: env.ANTHROPIC_API_KEY ? claudeTouristNotes(env.ANTHROPIC_API_KEY) : null,
  voice: voiceConfig ? elevenLabsVoice(voiceConfig) : null,
}

const dataDir = dirname(env.DB_PATH ?? 'data/gd.db')
const images =
  env.CITY_IMAGES === 'openai' && env.OPENAI_API_KEY
    ? openAiImages(env.OPENAI_API_KEY, env.CITY_IMAGE_MODEL || 'gpt-image-2')
    : env.CITY_IMAGES === 'google' && env.GOOGLE_API_KEY
    ? googleImages(env.GOOGLE_API_KEY, env.CITY_IMAGE_MODEL || 'gemini-2.5-flash-image')
    : env.CITY_IMAGES === 'elevenlabs' && env.ELEVENLABS_API_KEY
      ? elevenLabsImages(env.ELEVENLABS_API_KEY, env.CITY_IMAGE_MODEL || 'gemini-3.1-flash-image')
      : null
const scenes = new SceneStore(join(dataDir, 'city-scenes'), images)
const ambience = new AmbienceStore(join(dataDir, 'city-ambience'), env.ELEVENLABS_API_KEY ? elevenLabsSounds(env.ELEVENLABS_API_KEY) : null)

const port = Number(env.PORT ?? 3000)
const db = openDb(env.DB_PATH ?? 'data/gd.db')
const server = createServer(createApp(db, secret, { ...city, scenes, ambience }))
server.listen(port, () => console.log(`api on :${port}`))

const stop = () => server.close(() => { db.close(); process.exit(0) })
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
