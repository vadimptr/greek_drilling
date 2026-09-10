# Раздел «Речь» — план реализации

> Спека: docs/superpowers/specs/2026-09-10-speak-section-design.md. TDD для logic-модулей, коммит на задачу.

**Goal:** вкладка «Речь»: произнести слово → whisper на сервере → верно/неверно, свои очки/стрик/слабые.
**Architecture:** запись PCM в браузере → WAV 16 kHz → POST /api/transcribe (nginx → whisper-server) → сравнение на клиенте.
**Tech:** React/TS/Vitest; whisper.cpp v1.9.3 в docker (arm64), nginx proxy, docker network `infra`.

### Task 1: инфраструктура whisper — `deploy/whisper/*` (сделано), сборка на маке, проверка `/inference` wav-файлом.
### Task 2: nginx + compose приложения
- `nginx.conf`: `location = /api/transcribe` → `http://whisper:8080/inference`, body 2m, timeout 60s.
- `docker-compose.yml`: networks default + infra(external). scp на мак. `vite.config.ts` dev-прокси `/api`.
### Task 3: `src/logic/match.ts` + test — normalizeGreek, stripArticle, levenshtein, numeralValue, matchesWord.
### Task 4: `src/logic/wav.ts` + test — rms, downsample, encodeWav (PCM16 mono 16k).
### Task 5: обобщение state — `Progress` в state.ts, pickNext/isWin/applyAnswer generic; `src/logic/speakState.ts` (+test): SpeakState, initialSpeakState, skipWord, restartSpeak.
### Task 6: AppState v3 — `speak`, `speakHint`, Tab 'speak', ключ v3, миграция v2→v3, тесты.
### Task 7: `src/logic/transcribe.ts` + test (fetch мок) и `src/logic/recorder.ts` (без unit-тестов, thin).
### Task 8: UI — `TabBar` (4-я вкладка), `SettingsSheet` (подсказка речи), `screens/SpeakScreen.tsx`, `App.tsx` (шапка/экран/сброс), CSS.
### Task 9: проверка — `npm test`, `npm run build`, puppeteer с fake-audio против прод whisper; коммит, push, деплой, проверка на сайте.
