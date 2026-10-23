import { createServer } from 'node:http'
import { createApp } from './app.ts'
import { openDb } from './db.ts'

const secret = process.env.SESSION_SECRET
if (!secret || secret.length < 16) {
  console.error('SESSION_SECRET is required (16+ chars)')
  process.exit(1)
}

const port = Number(process.env.PORT ?? 3000)
const db = openDb(process.env.DB_PATH ?? 'data/gd.db')
const server = createServer(createApp(db, secret))
server.listen(port, () => console.log(`api on :${port}`))

const stop = () => server.close(() => { db.close(); process.exit(0) })
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
