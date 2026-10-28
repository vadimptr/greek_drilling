import { createServer } from 'node:http'
import { createApp } from './app.ts'
import { claudeFacts, claudeScenarios, claudeTranslator } from './city/claude.ts'
import { elevenLabsVoice, parseVoices } from './city/elevenlabs.ts'
import { parseAllowed } from './city/routes.ts'
import { openDb } from './db.ts'

const secret = process.env.SESSION_SECRET
if (!secret || secret.length < 16) {
  console.error('SESSION_SECRET is required (16+ chars)')
  process.exit(1)
}

const env = process.env
const city = {
  allowedUsers: parseAllowed(env.CITY_ALLOWED_USERS),
  dailyTalks: Number(env.CITY_DAILY_TALKS ?? 40),
  scenarios: env.ANTHROPIC_API_KEY ? claudeScenarios(env.ANTHROPIC_API_KEY) : null,
  facts: env.ANTHROPIC_API_KEY ? claudeFacts(env.ANTHROPIC_API_KEY) : null,
  translator: env.ANTHROPIC_API_KEY ? claudeTranslator(env.ANTHROPIC_API_KEY) : null,
  voice:
    env.ELEVENLABS_API_KEY && env.ELEVENLABS_AGENT_ID
      ? elevenLabsVoice({
          apiKey: env.ELEVENLABS_API_KEY,
          agentId: env.ELEVENLABS_AGENT_ID,
          voices: parseVoices(env.ELEVENLABS_VOICES),
          speed: Number(env.ELEVENLABS_SPEED ?? 0.9),
        })
      : null,
}

const port = Number(env.PORT ?? 3000)
const db = openDb(env.DB_PATH ?? 'data/gd.db')
const server = createServer(createApp(db, secret, city))
server.listen(port, () => console.log(`api on :${port}`))

const stop = () => server.close(() => { db.close(); process.exit(0) })
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
