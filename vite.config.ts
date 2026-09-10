/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // локальная разработка ходит за распознаванием на прод-сервер;
    // WHISPER_DIRECT=http://localhost:8089 — напрямую в whisper-server (например, через ssh-туннель)
    proxy: process.env.WHISPER_DIRECT
      ? { '/api/transcribe': { target: process.env.WHISPER_DIRECT, rewrite: () => '/inference' } }
      : { '/api': { target: 'https://languagedrilling.com', changeOrigin: true } },
  },
  test: {
    environment: 'node',
  },
})
