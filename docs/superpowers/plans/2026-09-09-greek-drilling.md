# Greek Drilling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Мобильный SPA для дрилла ~700 греческих слов A1 с четырьмя вариантами ответа, списком слабых слов, очками и стриком, задеплоенный через GitHub Actions на домашний мак (порт 9093).

**Architecture:** Vite + React + TS без бэкенда. Чистая логика в `src/logic` (выбор слова, ответ, дистракторы, хранение) покрыта Vitest. React-компоненты только рисуют и вызывают логику. Прогресс в localStorage. Статика в `nginx:alpine`, образ собирается в GitHub Actions, пушится в ghcr, деплой по ssh `docker compose pull && up`.

**Tech Stack:** Node 20, Vite 5, React 18, TypeScript 5 strict, Vitest 2, nginx:alpine, Docker, GitHub Actions, `gh` CLI.

Спека: `docs/superpowers/specs/2026-09-09-greek-drilling-design.md`.

---

## Структура файлов

| Файл | Ответственность |
|---|---|
| `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts` | сборка и тесты |
| `index.html`, `public/manifest.webmanifest`, `public/icons/*` | точка входа, PWA |
| `src/types/word.ts` | типы `Word`, `Pos`, `Direction` |
| `src/data/words.ts` | словарь (~700 слов), `WORDS` |
| `src/data/words.test.ts` | проверки словаря |
| `src/logic/state.ts` | `RoundState`, `initialState`, `applyAnswer`, `isWin`, `restart` |
| `src/logic/pick.ts` | `pickNext` — выбор следующего слова |
| `src/logic/options.ts` | `buildOptions`, `shuffle`, `labelOf` — 4 варианта |
| `src/logic/storage.ts` | `serialize`, `deserialize`, `loadState`, `saveState` |
| `src/logic/*.test.ts` | тесты логики |
| `src/components/Header.tsx` | очки, стрик, прогресс, кнопка настроек |
| `src/components/Prompt.tsx` | слово по центру |
| `src/components/Options.tsx` | 4 кнопки с анимациями |
| `src/components/SettingsSheet.tsx` | направление, сброс |
| `src/components/WinOverlay.tsx` | победа, конфетти, «Начать снова» |
| `src/App.tsx`, `src/main.tsx`, `src/index.css`, `src/App.css` | связка и стили |
| `Dockerfile`, `nginx.conf`, `docker-compose.yml`, `.dockerignore`, `.gitignore` | контейнер |
| `.github/workflows/main.yml` | CI/CD |

Все команды выполняются из `/Users/vadim.sultanov/sources/greek_drilling`.

---

### Task 1: Каркас проекта

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/vite-env.d.ts`

- [ ] **Step 1: package.json**

```json
{
  "name": "greek-drilling",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.3",
    "vite": "^5.4.2",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: vite.config.ts**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 5: index.html**

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="theme-color" content="#1d4ed8" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <title>Ελληνικά A1</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: .gitignore**

```
node_modules/
dist/
.DS_Store
*.local
```

- [ ] **Step 7: src/vite-env.d.ts, src/main.tsx, src/App.tsx (заглушка), src/index.css**

`src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```

`src/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

`src/App.tsx` (временно):
```tsx
export default function App() {
  return <div>Ελληνικά A1</div>
}
```

`src/index.css`:
```css
:root {
  color-scheme: light dark;
  --bg: #f5f6fa;
  --card: #ffffff;
  --text: #111827;
  --muted: #6b7280;
  --accent: #1d4ed8;
  --ok: #16a34a;
  --bad: #dc2626;
  --border: #e5e7eb;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-text-size-adjust: 100%;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f1115;
    --card: #1a1d24;
    --text: #f3f4f6;
    --muted: #9ca3af;
    --accent: #3b82f6;
    --ok: #22c55e;
    --bad: #ef4444;
    --border: #2a2f3a;
  }
}
* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body {
  background: var(--bg);
  color: var(--text);
  overscroll-behavior: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
button { font: inherit; color: inherit; }
```

- [ ] **Step 8: Установить зависимости и проверить сборку**

Run: `npm install && npm run build`
Expected: `dist/index.html` создан, ошибок tsc нет.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite react ts project"
```

---

### Task 2: Типы и состояние раунда

**Files:**
- Create: `src/types/word.ts`, `src/logic/state.ts`
- Test: `src/logic/state.test.ts`

- [ ] **Step 1: Типы**

`src/types/word.ts`:
```ts
export type Pos =
  | 'noun'
  | 'verb'
  | 'adj'
  | 'adv'
  | 'pron'
  | 'prep'
  | 'conj'
  | 'num'
  | 'phrase'
  | 'other'

export interface Word {
  id: number
  el: string
  ru: string
  pos: Pos
  topic: string
}

export type Direction = 'el-ru' | 'ru-el'
```

- [ ] **Step 2: Тест состояния**

`src/logic/state.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { Word } from '../types/word'
import { WEAK_REPEATS, applyAnswer, initialState, isWin, restart } from './state'

const words: Word[] = [
  { id: 1, el: 'το σπίτι', ru: 'дом', pos: 'noun', topic: 'home' },
  { id: 2, el: 'το νερό', ru: 'вода', pos: 'noun', topic: 'food' },
]

describe('applyAnswer', () => {
  it('correct on fresh word: +1 score, learned, bestStreak', () => {
    const s = applyAnswer(initialState(), 1, true)
    expect(s.score).toBe(1)
    expect(s.bestStreak).toBe(1)
    expect(s.learned).toEqual([1])
    expect(s.weak).toEqual({})
    expect(s.lastId).toBe(1)
  })

  it('wrong: score reset, word goes to weak with 3, removed from learned', () => {
    let s = applyAnswer(initialState(), 1, true)
    s = applyAnswer(s, 2, true)
    s = applyAnswer(s, 1, false)
    expect(s.score).toBe(0)
    expect(s.bestStreak).toBe(2)
    expect(s.weak).toEqual({ 1: WEAK_REPEATS })
    expect(s.learned).toEqual([2])
  })

  it('weak word needs 3 correct answers, then becomes learned', () => {
    let s = applyAnswer(initialState(), 1, false)
    s = applyAnswer(s, 1, true)
    expect(s.weak).toEqual({ 1: 2 })
    s = applyAnswer(s, 1, true)
    expect(s.weak).toEqual({ 1: 1 })
    expect(s.learned).toEqual([])
    s = applyAnswer(s, 1, true)
    expect(s.weak).toEqual({})
    expect(s.learned).toEqual([1])
    expect(s.score).toBe(3)
  })

  it('second mistake resets weak counter to 3', () => {
    let s = applyAnswer(initialState(), 1, false)
    s = applyAnswer(s, 1, true)
    s = applyAnswer(s, 1, false)
    expect(s.weak).toEqual({ 1: WEAK_REPEATS })
  })

  it('does not duplicate learned ids', () => {
    let s = applyAnswer(initialState(), 1, true)
    s = applyAnswer(s, 1, true)
    expect(s.learned).toEqual([1])
  })
})

describe('isWin / restart', () => {
  it('win only when all words learned and weak is empty', () => {
    let s = applyAnswer(initialState(), 1, true)
    expect(isWin(s, words)).toBe(false)
    s = applyAnswer(s, 2, false)
    expect(isWin(s, words)).toBe(false)
    s = applyAnswer(s, 2, true)
    s = applyAnswer(s, 2, true)
    s = applyAnswer(s, 2, true)
    expect(isWin(s, words)).toBe(true)
  })

  it('restart keeps direction and clears everything else', () => {
    let s = initialState('ru-el')
    s = applyAnswer(s, 1, true)
    const r = restart(s)
    expect(r).toEqual(initialState('ru-el'))
  })
})
```

- [ ] **Step 3: Запустить — должно упасть**

Run: `npx vitest run src/logic/state.test.ts`
Expected: FAIL, `Cannot find module './state'`.

- [ ] **Step 4: Реализация**

`src/logic/state.ts`:
```ts
import type { Direction, Word } from '../types/word'

export const WEAK_REPEATS = 3

export interface RoundState {
  learned: number[]
  weak: Record<number, number>
  score: number
  bestStreak: number
  lastId: number | null
  direction: Direction
}

export function initialState(direction: Direction = 'el-ru'): RoundState {
  return { learned: [], weak: {}, score: 0, bestStreak: 0, lastId: null, direction }
}

function addUnique(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids : [...ids, id]
}

export function applyAnswer(state: RoundState, wordId: number, correct: boolean): RoundState {
  const weak = { ...state.weak }
  let learned = state.learned

  if (!correct) {
    weak[wordId] = WEAK_REPEATS
    learned = learned.filter((id) => id !== wordId)
    return { ...state, weak, learned, score: 0, lastId: wordId }
  }

  const score = state.score + 1
  if (wordId in weak) {
    const left = weak[wordId] - 1
    if (left <= 0) {
      delete weak[wordId]
      learned = addUnique(learned, wordId)
    } else {
      weak[wordId] = left
    }
  } else {
    learned = addUnique(learned, wordId)
  }

  return {
    ...state,
    weak,
    learned,
    score,
    bestStreak: Math.max(state.bestStreak, score),
    lastId: wordId,
  }
}

export function isWin(state: RoundState, words: Word[]): boolean {
  if (Object.keys(state.weak).length > 0) return false
  const learned = new Set(state.learned)
  return words.every((w) => learned.has(w.id))
}

export function restart(state: RoundState): RoundState {
  return initialState(state.direction)
}
```

- [ ] **Step 5: Запустить — должно пройти**

Run: `npx vitest run src/logic/state.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add src/types/word.ts src/logic/state.ts src/logic/state.test.ts
git commit -m "feat: round state and answer rules"
```

---

### Task 3: Выбор следующего слова

**Files:**
- Create: `src/logic/pick.ts`
- Test: `src/logic/pick.test.ts`

- [ ] **Step 1: Тест**

`src/logic/pick.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { Word } from '../types/word'
import { initialState } from './state'
import { WEAK_PROBABILITY, pickNext } from './pick'

const w = (id: number): Word => ({ id, el: `el${id}`, ru: `ru${id}`, pos: 'noun', topic: 't' })
const words = [w(1), w(2), w(3), w(4)]

/** rng, выдающий значения по очереди */
const seq = (...values: number[]) => {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

describe('pickNext', () => {
  it('picks from fresh words when there are no weak words', () => {
    const s = { ...initialState(), learned: [1, 2] }
    expect(pickNext(s, words, seq(0))?.id).toBe(3)
    expect(pickNext(s, words, seq(0.99))?.id).toBe(4)
  })

  it('picks weak when rng below WEAK_PROBABILITY', () => {
    const s = { ...initialState(), weak: { 4: 3 } }
    expect(pickNext(s, words, seq(WEAK_PROBABILITY - 0.01, 0))?.id).toBe(4)
  })

  it('picks fresh when rng at or above WEAK_PROBABILITY', () => {
    const s = { ...initialState(), weak: { 4: 3 } }
    expect(pickNext(s, words, seq(WEAK_PROBABILITY, 0))?.id).toBe(1)
  })

  it('always picks weak when no fresh words remain', () => {
    const s = { ...initialState(), learned: [1, 2, 3], weak: { 4: 1 } }
    expect(pickNext(s, words, seq(0.99, 0))?.id).toBe(4)
  })

  it('avoids repeating lastId when pool has alternatives', () => {
    const s = { ...initialState(), learned: [1, 2], lastId: 3 }
    expect(pickNext(s, words, seq(0))?.id).toBe(4)
    expect(pickNext(s, words, seq(0.99))?.id).toBe(4)
  })

  it('switches pool when chosen pool contains only lastId', () => {
    const weakOnlyLast = { ...initialState(), weak: { 4: 2 }, lastId: 4 }
    expect(pickNext(weakOnlyLast, words, seq(0, 0))?.id).toBe(1)
    const freshOnlyLast = { ...initialState(), learned: [1, 2], weak: { 4: 2 }, lastId: 3 }
    expect(pickNext(freshOnlyLast, words, seq(0.99, 0))?.id).toBe(4)
  })

  it('repeats lastId when it is the only word left', () => {
    const s = { ...initialState(), learned: [1, 2, 3], weak: { 4: 1 }, lastId: 4 }
    expect(pickNext(s, words, seq(0))?.id).toBe(4)
  })

  it('returns null when everything is learned', () => {
    const s = { ...initialState(), learned: [1, 2, 3, 4] }
    expect(pickNext(s, words, seq(0))).toBeNull()
  })
})
```

- [ ] **Step 2: Запустить — должно упасть**

Run: `npx vitest run src/logic/pick.test.ts`
Expected: FAIL, `Cannot find module './pick'`.

- [ ] **Step 3: Реализация**

`src/logic/pick.ts`:
```ts
import type { Word } from '../types/word'
import type { RoundState } from './state'

/** Вероятность взять слово из слабого списка, если есть и слабые, и новые. */
export const WEAK_PROBABILITY = 0.7

export type Rng = () => number

export function pickNext(state: RoundState, words: Word[], rng: Rng = Math.random): Word | null {
  const learned = new Set(state.learned)
  const weakSet = new Set(Object.keys(state.weak).map(Number))

  const fresh = words.filter((w) => !learned.has(w.id) && !weakSet.has(w.id))
  const weak = words.filter((w) => weakSet.has(w.id))

  if (fresh.length === 0 && weak.length === 0) return null

  let useWeak: boolean
  if (weak.length === 0) useWeak = false
  else if (fresh.length === 0) useWeak = true
  else useWeak = rng() < WEAK_PROBABILITY

  let pool = useWeak ? weak : fresh
  const other = useWeak ? fresh : weak
  if (pool.length === 1 && pool[0].id === state.lastId && other.length > 0) {
    pool = other
  }
  if (pool.length > 1 && state.lastId !== null) {
    pool = pool.filter((w) => w.id !== state.lastId)
  }

  return pool[Math.floor(rng() * pool.length)]
}
```

- [ ] **Step 4: Запустить — должно пройти**

Run: `npx vitest run src/logic/pick.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/logic/pick.ts src/logic/pick.test.ts
git commit -m "feat: next word picker with weak-list bias"
```

---

### Task 4: Варианты ответа

**Files:**
- Create: `src/logic/options.ts`
- Test: `src/logic/options.test.ts`

- [ ] **Step 1: Тест**

`src/logic/options.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { Word } from '../types/word'
import { OPTION_COUNT, buildOptions, labelOf, shuffle } from './options'

const words: Word[] = [
  { id: 1, el: 'το σπίτι', ru: 'дом', pos: 'noun', topic: 'home' },
  { id: 2, el: 'το νερό', ru: 'вода', pos: 'noun', topic: 'food' },
  { id: 3, el: 'ο άνθρωπος', ru: 'человек', pos: 'noun', topic: 'people' },
  { id: 4, el: 'η πόλη', ru: 'город', pos: 'noun', topic: 'city' },
  { id: 5, el: 'το ψωμί', ru: 'хлеб', pos: 'noun', topic: 'food' },
  { id: 6, el: 'τρώω', ru: 'есть', pos: 'verb', topic: 'verbs' },
  { id: 7, el: 'πίνω', ru: 'пить', pos: 'verb', topic: 'verbs' },
  { id: 8, el: 'καλός', ru: 'хороший', pos: 'adj', topic: 'adj' },
  { id: 9, el: 'άλλο νερό', ru: 'вода', pos: 'noun', topic: 'dup' },
]

const rng = () => 0.5

describe('labelOf', () => {
  it('returns ru for el-ru and el for ru-el', () => {
    expect(labelOf(words[0], 'el-ru')).toBe('дом')
    expect(labelOf(words[0], 'ru-el')).toBe('το σπίτι')
  })
})

describe('shuffle', () => {
  it('returns a permutation and does not mutate input', () => {
    const input = [1, 2, 3, 4, 5]
    const out = shuffle(input, Math.random)
    expect(out).toHaveLength(5)
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5])
    expect(input).toEqual([1, 2, 3, 4, 5])
  })
})

describe('buildOptions', () => {
  it('returns 4 options including the target, all labels unique', () => {
    const target = words[0]
    const opts = buildOptions(target, words, 'el-ru', rng)
    expect(opts).toHaveLength(OPTION_COUNT)
    expect(opts.some((o) => o.id === target.id)).toBe(true)
    const labels = opts.map((o) => labelOf(o, 'el-ru'))
    expect(new Set(labels).size).toBe(OPTION_COUNT)
  })

  it('prefers same part of speech', () => {
    const target = words[0]
    const opts = buildOptions(target, words, 'el-ru', rng)
    expect(opts.every((o) => o.pos === 'noun')).toBe(true)
  })

  it('falls back to other parts of speech when same pos is scarce', () => {
    const target = words[5] // τρώω, единственный другой глагол — πίνω
    const opts = buildOptions(target, words, 'el-ru', rng)
    expect(opts).toHaveLength(OPTION_COUNT)
    expect(opts.some((o) => o.id === 7)).toBe(true)
  })

  it('excludes distractors whose label equals the target label', () => {
    const target = words[1] // вода
    for (let i = 0; i < 20; i++) {
      const opts = buildOptions(target, words, 'el-ru', Math.random)
      expect(opts.filter((o) => labelOf(o, 'el-ru') === 'вода')).toHaveLength(1)
    }
  })

  it('returns fewer options when dictionary is too small', () => {
    const opts = buildOptions(words[0], words.slice(0, 2), 'el-ru', rng)
    expect(opts).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Запустить — должно упасть**

Run: `npx vitest run src/logic/options.test.ts`
Expected: FAIL, `Cannot find module './options'`.

- [ ] **Step 3: Реализация**

`src/logic/options.ts`:
```ts
import type { Direction, Word } from '../types/word'
import type { Rng } from './pick'

export const OPTION_COUNT = 4

/** Текст варианта ответа для данного направления. */
export function labelOf(word: Word, direction: Direction): string {
  return direction === 'el-ru' ? word.ru : word.el
}

/** Текст вопроса (то, что показываем по центру). */
export function promptOf(word: Word, direction: Direction): string {
  return direction === 'el-ru' ? word.el : word.ru
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function buildOptions(
  target: Word,
  words: Word[],
  direction: Direction,
  rng: Rng = Math.random,
): Word[] {
  const used = new Set([labelOf(target, direction)])
  const candidates = words.filter((w) => w.id !== target.id)
  const samePos = shuffle(candidates.filter((w) => w.pos === target.pos), rng)
  const otherPos = shuffle(candidates.filter((w) => w.pos !== target.pos), rng)

  const picked: Word[] = []
  for (const w of [...samePos, ...otherPos]) {
    if (picked.length >= OPTION_COUNT - 1) break
    const label = labelOf(w, direction)
    if (used.has(label)) continue
    used.add(label)
    picked.push(w)
  }

  return shuffle([target, ...picked], rng)
}
```

- [ ] **Step 4: Запустить — должно пройти**

Run: `npx vitest run src/logic/options.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/logic/options.ts src/logic/options.test.ts
git commit -m "feat: build answer options with same-pos distractors"
```

---

### Task 5: Хранение в localStorage

**Files:**
- Create: `src/logic/storage.ts`
- Test: `src/logic/storage.test.ts`

- [ ] **Step 1: Тест**

`src/logic/storage.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { Word } from '../types/word'
import { initialState } from './state'
import { STORAGE_KEY, deserialize, loadState, saveState, serialize } from './storage'

const w = (id: number): Word => ({ id, el: `el${id}`, ru: `ru${id}`, pos: 'noun', topic: 't' })
const words = [w(1), w(2), w(3)]

class MemoryStorage {
  data = new Map<string, string>()
  getItem(k: string) {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.data.set(k, v)
  }
}

describe('serialize/deserialize', () => {
  it('round-trips a state', () => {
    const s = { ...initialState('ru-el'), learned: [1], weak: { 2: 2 }, score: 3, bestStreak: 5, lastId: 2 }
    expect(deserialize(serialize(s), words)).toEqual(s)
  })

  it('returns initial state for null, garbage and wrong shapes', () => {
    expect(deserialize(null, words)).toEqual(initialState())
    expect(deserialize('not json', words)).toEqual(initialState())
    expect(deserialize('[]', words)).toEqual(initialState())
    expect(deserialize('{"learned":"x"}', words)).toEqual(initialState())
  })

  it('drops ids that are not in the dictionary and invalid weak counters', () => {
    const raw = JSON.stringify({
      learned: [1, 99, 'a'],
      weak: { 2: 1, 77: 3, 3: 0 },
      score: 2,
      bestStreak: 4,
      lastId: 99,
      direction: 'el-ru',
    })
    expect(deserialize(raw, words)).toEqual({
      ...initialState(),
      learned: [1],
      weak: { 2: 1 },
      score: 2,
      bestStreak: 4,
      lastId: null,
    })
  })

  it('falls back to el-ru for unknown direction', () => {
    const raw = JSON.stringify({ ...initialState(), direction: 'xx' })
    expect(deserialize(raw, words).direction).toBe('el-ru')
  })
})

describe('loadState/saveState', () => {
  it('saves under STORAGE_KEY and loads back', () => {
    const storage = new MemoryStorage()
    const s = { ...initialState(), learned: [3], score: 1, bestStreak: 1, lastId: 3 }
    saveState(storage, s)
    expect(storage.getItem(STORAGE_KEY)).toBe(serialize(s))
    expect(loadState(storage, words)).toEqual(s)
  })

  it('saveState swallows storage errors', () => {
    const broken = {
      setItem() {
        throw new Error('quota')
      },
    }
    expect(() => saveState(broken, initialState())).not.toThrow()
  })
})
```

- [ ] **Step 2: Запустить — должно упасть**

Run: `npx vitest run src/logic/storage.test.ts`
Expected: FAIL, `Cannot find module './storage'`.

- [ ] **Step 3: Реализация**

`src/logic/storage.ts`:
```ts
import type { Direction, Word } from '../types/word'
import { initialState, type RoundState } from './state'

export const STORAGE_KEY = 'greek_drilling.v1'

type Reader = Pick<Storage, 'getItem'>
type Writer = Pick<Storage, 'setItem'>

export function serialize(state: RoundState): string {
  return JSON.stringify(state)
}

const isNonNegInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0

export function deserialize(raw: string | null, words: Word[]): RoundState {
  if (raw === null) return initialState()
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return initialState()
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return initialState()

  const obj = parsed as Record<string, unknown>
  if (!Array.isArray(obj.learned)) return initialState()
  if (typeof obj.weak !== 'object' || obj.weak === null || Array.isArray(obj.weak)) return initialState()

  const known = new Set(words.map((w) => w.id))
  const direction: Direction = obj.direction === 'ru-el' ? 'ru-el' : 'el-ru'

  const learned = obj.learned.filter((id): id is number => isNonNegInt(id) && known.has(id))

  const weak: Record<number, number> = {}
  for (const [k, v] of Object.entries(obj.weak as Record<string, unknown>)) {
    const id = Number(k)
    if (known.has(id) && isNonNegInt(v) && v > 0) weak[id] = v
  }

  const score = isNonNegInt(obj.score) ? obj.score : 0
  const bestStreak = isNonNegInt(obj.bestStreak) ? obj.bestStreak : 0
  const lastId = isNonNegInt(obj.lastId) && known.has(obj.lastId) ? obj.lastId : null

  return { learned, weak, score, bestStreak, lastId, direction }
}

export function loadState(storage: Reader, words: Word[]): RoundState {
  try {
    return deserialize(storage.getItem(STORAGE_KEY), words)
  } catch {
    return initialState()
  }
}

export function saveState(storage: Writer, state: RoundState): void {
  try {
    storage.setItem(STORAGE_KEY, serialize(state))
  } catch {
    // localStorage недоступен или переполнен — прогресс просто не сохранится
  }
}
```

- [ ] **Step 4: Запустить — должно пройти**

Run: `npx vitest run src/logic/storage.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/logic/storage.ts src/logic/storage.test.ts
git commit -m "feat: persist round state in localStorage with validation"
```

---

### Task 6: Словарь A1

**Files:**
- Create: `src/data/words.ts`
- Test: `src/data/words.test.ts`

- [ ] **Step 1: Тест словаря**

`src/data/words.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { WORDS } from './words'

describe('WORDS', () => {
  it('has between 600 and 800 entries', () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(600)
    expect(WORDS.length).toBeLessThanOrEqual(800)
  })

  it('has unique ids equal to index + 1', () => {
    WORDS.forEach((w, i) => expect(w.id).toBe(i + 1))
  })

  it('has unique greek words (case-insensitive, trimmed)', () => {
    const seen = new Map<string, number>()
    for (const w of WORDS) {
      const key = w.el.trim().toLowerCase()
      expect(seen.has(key), `duplicate el "${w.el}" (ids ${seen.get(key)} and ${w.id})`).toBe(false)
      seen.set(key, w.id)
    }
  })

  it('has unique russian translations (case-insensitive, trimmed)', () => {
    const seen = new Map<string, number>()
    for (const w of WORDS) {
      const key = w.ru.trim().toLowerCase()
      expect(seen.has(key), `duplicate ru "${w.ru}" (ids ${seen.get(key)} and ${w.id})`).toBe(false)
      seen.set(key, w.id)
    }
  })

  it('has non-empty fields and greek letters in el', () => {
    for (const w of WORDS) {
      expect(w.el.trim().length, `empty el for id ${w.id}`).toBeGreaterThan(0)
      expect(w.ru.trim().length, `empty ru for id ${w.id}`).toBeGreaterThan(0)
      expect(w.topic.trim().length, `empty topic for id ${w.id}`).toBeGreaterThan(0)
      expect(/[Ͱ-Ͽἀ-῿]/.test(w.el), `no greek letters in "${w.el}"`).toBe(true)
    }
  })

  it('nouns carry an article', () => {
    for (const w of WORDS) {
      if (w.pos !== 'noun') continue
      expect(/^(ο|η|το|οι|τα) /.test(w.el), `noun without article: "${w.el}" (id ${w.id})`).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Запустить — должно упасть**

Run: `npx vitest run src/data/words.test.ts`
Expected: FAIL, `Cannot find module './words'`.

- [ ] **Step 3: Написать словарь**

`src/data/words.ts` — формат:

```ts
import type { Word } from '../types/word'

export const WORDS: Word[] = [
  { id: 1, el: 'γεια σου', ru: 'привет (ты)', pos: 'phrase', topic: 'greetings' },
  { id: 2, el: 'γεια σας', ru: 'здравствуйте', pos: 'phrase', topic: 'greetings' },
  { id: 3, el: 'καλημέρα', ru: 'доброе утро', pos: 'phrase', topic: 'greetings' },
  { id: 4, el: 'το σπίτι', ru: 'дом', pos: 'noun', topic: 'home' },
  { id: 5, el: 'τρώω', ru: 'есть (кушать)', pos: 'verb', topic: 'verbs' },
  // ...
]
```

Требования к содержимому:
- 650–750 записей, `id` = позиция + 1, без пропусков.
- Уровень A1 (учебники «Ελληνικά Α», «Κλικ στα ελληνικά A1», частотные списки).
- Темы (`topic`) и ориентировочный объём: `greetings` 25, `numbers` 35 (0–20, 30…100, 1000, первый…), `time` 45 (дни, месяцы, времена года, части дня, сегодня/завтра), `family` 30, `people` 25 (мужчина, друг, ребёнок…), `food` 60, `home` 45, `city` 40, `transport` 25, `body` 25, `health` 15, `clothes` 20, `weather` 20, `nature` 20, `colors` 12, `work` 25 (профессии, школа), `shopping` 20, `verbs` 110, `adjectives` 55, `adverbs` 30, `pronouns` 25, `prepositions` 15, `conjunctions` 12, `questions` 10, `phrases` 30 (ευχαριστώ, παρακαλώ, συγγνώμη, τι κάνεις…).
- Существительные с артиклем `ο/η/το` (множественное `οι/τα` только если слово употребляется во множественном).
- Глаголы в 1-м лице ед. числа наст. времени (`τρώω`, `πίνω`).
- Прилагательные в мужском роде ед. числа (`καλός`).
- `ru` — одно короткое значение. Если оно совпадает с другим словом, уточнять в скобках: `есть (кушать)` / `есть (иметься)`, `ключ (от двери)`. Тест на уникальность `ru` обязан пройти.
- Один язык в `ru` (кириллица, без латиницы, кроме пояснений в скобках).

Удобно писать по темам блоками с комментарием `// --- topic ---` внутри массива и проставлять `id` в конце скриптом:

```bash
node -e '
const fs=require("fs");let n=0;
const src=fs.readFileSync("src/data/words.ts","utf8")
  .replace(/\{ id: \d+,/g,()=>`{ id: ${++n},`);
fs.writeFileSync("src/data/words.ts",src);console.log(n)'
```

- [ ] **Step 4: Запустить — должно пройти**

Run: `npx vitest run src/data/words.test.ts`
Expected: PASS, 6 tests. При дублях тест печатает оба id — исправить перевод и повторить.

- [ ] **Step 5: Commit**

```bash
git add src/data/words.ts src/data/words.test.ts
git commit -m "feat: A1 greek vocabulary (~700 words)"
```

---

### Task 7: Компоненты UI

**Files:**
- Create: `src/components/Header.tsx`, `src/components/Prompt.tsx`, `src/components/Options.tsx`, `src/components/SettingsSheet.tsx`, `src/components/WinOverlay.tsx`, `src/App.css`

- [ ] **Step 1: Header**

`src/components/Header.tsx`:
```tsx
interface Props {
  score: number
  bestStreak: number
  learnedCount: number
  weakCount: number
  total: number
  onSettings: () => void
}

export function Header({ score, bestStreak, learnedCount, weakCount, total, onSettings }: Props) {
  const pct = total === 0 ? 0 : Math.round((learnedCount / total) * 100)
  return (
    <header className="header">
      <div className="header-row">
        <div className="stat" aria-label="Очки">
          <span className="stat-icon">⚡</span>
          <span key={score} className="stat-value score-bump">
            {score}
          </span>
        </div>
        <div className="stat" aria-label="Лучший стрик">
          <span className="stat-icon">🏆</span>
          <span className="stat-value">{bestStreak}</span>
        </div>
        <button className="icon-btn" onClick={onSettings} aria-label="Настройки">
          ⚙︎
        </button>
      </div>
      <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="progress-label">
        Выучено {learnedCount} / {total} · слабых {weakCount}
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Prompt**

`src/components/Prompt.tsx`:
```tsx
import type { Direction, Pos, Word } from '../types/word'
import { promptOf } from '../logic/options'

const POS_LABEL: Record<Pos, string> = {
  noun: 'существительное',
  verb: 'глагол',
  adj: 'прилагательное',
  adv: 'наречие',
  pron: 'местоимение',
  prep: 'предлог',
  conj: 'союз',
  num: 'числительное',
  phrase: 'фраза',
  other: '',
}

interface Props {
  word: Word
  direction: Direction
}

export function Prompt({ word, direction }: Props) {
  return (
    <main className="prompt">
      <div key={word.id} className="prompt-word">
        {promptOf(word, direction)}
      </div>
      <div className="prompt-pos">{POS_LABEL[word.pos]}</div>
    </main>
  )
}
```

- [ ] **Step 3: Options**

`src/components/Options.tsx`:
```tsx
import type { Direction, Word } from '../types/word'
import { labelOf } from '../logic/options'

export interface Feedback {
  chosenId: number
  correct: boolean
}

interface Props {
  options: Word[]
  targetId: number
  direction: Direction
  feedback: Feedback | null
  onSelect: (option: Word) => void
}

export function Options({ options, targetId, direction, feedback, onSelect }: Props) {
  return (
    <section className="options">
      {options.map((o) => {
        let cls = 'option'
        if (feedback) {
          if (o.id === targetId) cls += ' option-correct'
          else if (o.id === feedback.chosenId) cls += ' option-wrong'
          else cls += ' option-dim'
        }
        return (
          <button key={o.id} className={cls} disabled={feedback !== null} onClick={() => onSelect(o)}>
            {labelOf(o, direction)}
          </button>
        )
      })}
    </section>
  )
}
```

- [ ] **Step 4: SettingsSheet**

`src/components/SettingsSheet.tsx`:
```tsx
import type { Direction } from '../types/word'

interface Props {
  open: boolean
  direction: Direction
  onDirection: (d: Direction) => void
  onReset: () => void
  onClose: () => void
}

export function SettingsSheet({ open, direction, onDirection, onReset, onClose }: Props) {
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2 className="sheet-title">Настройки</h2>

        <div className="sheet-label">Направление</div>
        <div className="segmented">
          <button
            className={direction === 'el-ru' ? 'seg seg-active' : 'seg'}
            onClick={() => onDirection('el-ru')}
          >
            Ελληνικά → Русский
          </button>
          <button
            className={direction === 'ru-el' ? 'seg seg-active' : 'seg'}
            onClick={() => onDirection('ru-el')}
          >
            Русский → Ελληνικά
          </button>
        </div>

        <button
          className="danger-btn"
          onClick={() => {
            if (window.confirm('Сбросить весь прогресс?')) onReset()
          }}
        >
          Сбросить прогресс
        </button>

        <button className="secondary-btn" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: WinOverlay**

`src/components/WinOverlay.tsx`:
```tsx
import { useMemo } from 'react'

interface Props {
  total: number
  bestStreak: number
  onRestart: () => void
}

const COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899']

export function WinOverlay({ total, bestStreak, onRestart }: Props) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 12) * 0.15}s`,
        duration: `${2.2 + (i % 5) * 0.3}s`,
        color: COLORS[i % COLORS.length],
        rotate: `${(i * 53) % 360}deg`,
      })),
    [],
  )
  return (
    <div className="win">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti"
          style={{
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.duration,
            background: p.color,
            transform: `rotate(${p.rotate})`,
          }}
        />
      ))}
      <div className="win-card">
        <div className="win-emoji">🎉</div>
        <h1 className="win-title">Все {total} слов!</h1>
        <p className="win-sub">Лучший стрик: {bestStreak}</p>
        <button className="primary-btn" onClick={onRestart}>
          Начать снова
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: App.css**

`src/App.css`:
```css
.app {
  height: 100dvh;
  display: grid;
  grid-template-rows: auto 1fr auto;
  padding: calc(env(safe-area-inset-top) + 8px) 16px calc(env(safe-area-inset-bottom) + 12px);
  max-width: 520px;
  margin: 0 auto;
}

/* header */
.header { display: flex; flex-direction: column; gap: 8px; }
.header-row { display: flex; align-items: center; gap: 12px; }
.stat { display: flex; align-items: center; gap: 6px; font-size: 20px; font-weight: 600; }
.stat:nth-child(2) { margin-left: auto; }
.stat-icon { font-size: 18px; }
.stat-value { display: inline-block; min-width: 1.2em; }
.score-bump { animation: bump 0.3s ease; }
@keyframes bump {
  0% { transform: scale(1); }
  40% { transform: scale(1.35); }
  100% { transform: scale(1); }
}
.icon-btn {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: 40px;
  height: 40px;
  font-size: 20px;
  line-height: 1;
}
.progress { height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--accent); transition: width 0.3s ease; }
.progress-label { font-size: 13px; color: var(--muted); }

/* prompt */
.prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 8px;
  padding: 16px 0;
}
.prompt-word {
  font-size: clamp(32px, 9vw, 44px);
  font-weight: 700;
  line-height: 1.15;
  overflow-wrap: anywhere;
  animation: fade-in 0.25s ease;
}
@keyframes fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}
.prompt-pos { font-size: 14px; color: var(--muted); }

/* options */
.options { display: grid; gap: 10px; }
.option {
  min-height: 60px;
  padding: 12px 16px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--card);
  font-size: 19px;
  font-weight: 500;
  text-align: center;
  transition: background 0.15s, border-color 0.15s, opacity 0.2s, transform 0.15s;
}
.option:active:not(:disabled) { transform: scale(0.98); }
.option:disabled { cursor: default; }
.option-correct {
  background: var(--ok);
  border-color: var(--ok);
  color: #fff;
  animation: pulse 0.45s ease;
}
.option-wrong {
  background: var(--bad);
  border-color: var(--bad);
  color: #fff;
  animation: shake 0.45s ease;
}
.option-dim { opacity: 0.45; }
@keyframes pulse {
  0% { transform: scale(1); }
  40% { transform: scale(1.05); }
  100% { transform: scale(1); }
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-8px); }
  40% { transform: translateX(8px); }
  60% { transform: translateX(-6px); }
  80% { transform: translateX(6px); }
}

/* settings sheet */
.sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
  z-index: 10;
}
.sheet {
  width: 100%;
  max-width: 520px;
  margin: 0 auto;
  background: var(--card);
  border-radius: 20px 20px 0 0;
  padding: 20px 20px calc(env(safe-area-inset-bottom) + 20px);
  display: flex;
  flex-direction: column;
  gap: 14px;
  animation: slide-up 0.25s ease;
}
@keyframes slide-up {
  from { transform: translateY(40px); opacity: 0; }
  to { transform: none; opacity: 1; }
}
.sheet-title { margin: 0; font-size: 20px; }
.sheet-label { font-size: 13px; color: var(--muted); }
.segmented { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; background: var(--bg); padding: 4px; border-radius: 12px; }
.seg { border: none; background: transparent; border-radius: 9px; padding: 10px 6px; font-size: 14px; }
.seg-active { background: var(--accent); color: #fff; font-weight: 600; }
.danger-btn, .secondary-btn, .primary-btn {
  min-height: 48px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--bg);
  font-size: 16px;
  font-weight: 500;
}
.danger-btn { color: var(--bad); border-color: var(--bad); }
.primary-btn { background: var(--accent); border-color: var(--accent); color: #fff; font-size: 18px; padding: 0 28px; }

/* win */
.win {
  position: fixed;
  inset: 0;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  z-index: 20;
}
.win-card { text-align: center; display: flex; flex-direction: column; gap: 12px; align-items: center; padding: 24px; z-index: 1; }
.win-emoji { font-size: 72px; animation: bump 0.8s ease infinite alternate; }
.win-title { margin: 0; font-size: 30px; }
.win-sub { margin: 0; color: var(--muted); font-size: 18px; }
.confetti {
  position: absolute;
  top: -12px;
  width: 10px;
  height: 16px;
  border-radius: 2px;
  animation-name: fall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
@keyframes fall {
  to { transform: translateY(110vh) rotate(720deg); }
}
```

- [ ] **Step 7: Проверить типы**

Run: `npx tsc --noEmit`
Expected: без ошибок (компоненты ещё не подключены, но должны компилироваться).

- [ ] **Step 8: Commit**

```bash
git add src/components src/App.css
git commit -m "feat: ui components for drill screen"
```

---

### Task 8: App — связка логики и UI

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: App.tsx**

```tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { WORDS } from './data/words'
import { buildOptions } from './logic/options'
import { pickNext } from './logic/pick'
import { applyAnswer, isWin, restart, type RoundState } from './logic/state'
import { loadState, saveState } from './logic/storage'
import type { Direction, Word } from './types/word'
import { Header } from './components/Header'
import { Prompt } from './components/Prompt'
import { Options, type Feedback } from './components/Options'
import { SettingsSheet } from './components/SettingsSheet'
import { WinOverlay } from './components/WinOverlay'

const CORRECT_DELAY_MS = 500
const WRONG_DELAY_MS = 1100

interface Question {
  word: Word
  options: Word[]
}

function makeQuestion(state: RoundState): Question | null {
  const word = pickNext(state, WORDS)
  if (!word) return null
  return { word, options: buildOptions(word, WORDS, state.direction) }
}

export default function App() {
  const [state, setState] = useState<RoundState>(() => loadState(localStorage, WORDS))
  const [question, setQuestion] = useState<Question | null>(() => makeQuestion(state))
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    saveState(localStorage, state)
  }, [state])

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  const answer = useCallback(
    (option: Word) => {
      if (!question || feedback) return
      const correct = option.id === question.word.id
      const next = applyAnswer(state, question.word.id, correct)
      setFeedback({ chosenId: option.id, correct })
      setState(next)
      timer.current = window.setTimeout(() => {
        timer.current = null
        setFeedback(null)
        setQuestion(makeQuestion(next))
      }, correct ? CORRECT_DELAY_MS : WRONG_DELAY_MS)
    },
    [question, feedback, state],
  )

  const changeDirection = (direction: Direction) => {
    const next = { ...state, direction }
    setState(next)
    setQuestion((q) => (q ? { word: q.word, options: buildOptions(q.word, WORDS, direction) } : q))
  }

  const resetAll = () => {
    const next = restart(state)
    setState(next)
    setFeedback(null)
    setQuestion(makeQuestion(next))
    setSettingsOpen(false)
  }

  const won = isWin(state, WORDS)
  const weakCount = Object.keys(state.weak).length

  return (
    <div className="app">
      <Header
        score={state.score}
        bestStreak={state.bestStreak}
        learnedCount={state.learned.length}
        weakCount={weakCount}
        total={WORDS.length}
        onSettings={() => setSettingsOpen(true)}
      />

      {question && <Prompt word={question.word} direction={state.direction} />}

      {question && (
        <Options
          options={question.options}
          targetId={question.word.id}
          direction={state.direction}
          feedback={feedback}
          onSelect={answer}
        />
      )}

      <SettingsSheet
        open={settingsOpen}
        direction={state.direction}
        onDirection={changeDirection}
        onReset={resetAll}
        onClose={() => setSettingsOpen(false)}
      />

      {won && !feedback && <WinOverlay total={WORDS.length} bestStreak={state.bestStreak} onRestart={resetAll} />}
    </div>
  )
}
```

- [ ] **Step 2: Собрать и посмотреть в браузере**

Run: `npm run build && npm run preview -- --host --port 4173 &` затем открыть `http://localhost:4173` в мобильном режиме DevTools (iPhone). Проверить: слово по центру, 4 кнопки, зелёный/красный отклик, очки, стрик, шторка настроек, смена направления, сброс.

Быстрая проверка победы без 700 ответов — в консоли браузера:
```js
localStorage.setItem('greek_drilling.v1', JSON.stringify({learned: Array.from({length: 9999}, (_, i) => i + 1), weak: {}, score: 0, bestStreak: 42, lastId: null, direction: 'el-ru'})); location.reload()
```
Ожидание: экран победы с конфетти, «Начать снова» возвращает к дриллу с нулями.

- [ ] **Step 3: Тесты и типы**

Run: `npm test && npx tsc --noEmit`
Expected: все тесты PASS, tsc чист.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire drill screen, settings and win overlay"
```

---

### Task 9: PWA-иконки и манифест

**Files:**
- Create: `public/manifest.webmanifest`, `public/icons/icon.svg`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/apple-touch-icon.png`

- [ ] **Step 1: SVG-иконка**

`public/icons/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#1d4ed8"/>
  <text x="256" y="345" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="300" font-weight="bold" fill="#ffffff">Ω</text>
</svg>
```

- [ ] **Step 2: PNG через qlmanage (macOS)**

```bash
cd public/icons
qlmanage -t -s 512 -o . icon.svg && mv icon.svg.png icon-512.png
qlmanage -t -s 192 -o . icon.svg && mv icon.svg.png icon-192.png
qlmanage -t -s 180 -o . icon.svg && mv icon.svg.png apple-touch-icon.png
cd ../..
file public/icons/*.png
```
Expected: три PNG нужных размеров. Если qlmanage не отрисовал текст, заменить `<text>` на простую фигуру (круг) — иконка вторична.

- [ ] **Step 3: Манифест**

`public/manifest.webmanifest`:
```json
{
  "name": "Ελληνικά A1",
  "short_name": "Ελληνικά",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f1115",
  "theme_color": "#1d4ed8",
  "lang": "ru",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 4: Сборка**

Run: `npm run build && ls dist/icons dist/manifest.webmanifest`
Expected: файлы скопированы в dist.

- [ ] **Step 5: Commit**

```bash
git add public
git commit -m "feat: pwa manifest and icons"
```

---

### Task 10: Docker

**Files:**
- Create: `Dockerfile`, `nginx.conf`, `docker-compose.yml`, `.dockerignore`

- [ ] **Step 1: Dockerfile**

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Serve stage
FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 2: nginx.conf**

```nginx
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/manifest+json text/javascript image/svg+xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

- [ ] **Step 3: docker-compose.yml**

```yaml
services:
  greek-drilling:
    image: ghcr.io/vadimptr/greek_drilling/app:latest
    ports:
      - "9093:80"
    restart: unless-stopped
```

- [ ] **Step 4: .dockerignore**

```
node_modules
dist
.git
docs
```

- [ ] **Step 5: Локальная проверка образа (если Docker есть локально; иначе пропустить)**

Run: `docker build -t greek_drilling . && docker run --rm -d -p 9093:80 --name gd greek_drilling && sleep 1 && curl -s localhost:9093 | head -5; docker rm -f gd`
Expected: HTML с `<title>Ελληνικά A1</title>`.

- [ ] **Step 6: Commit**

```bash
git add Dockerfile nginx.conf docker-compose.yml .dockerignore
git commit -m "chore: docker image and compose on port 9093"
```

---

### Task 11: GitHub Actions

**Files:**
- Create: `.github/workflows/main.yml`

- [ ] **Step 1: Workflow**

```yaml
name: Build and deploy

on:
  push:
    branches: [master]
  pull_request:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.actor }}/greek_drilling/app:latest
  PROJECT_NAME: greek_drilling

jobs:
  build:
    name: Test, build and push image
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npm test

      - name: Login to GitHub Container Registry
        if: github.event_name == 'push'
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Docker build
        run: docker build --tag ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }} .

      - name: Docker push
        if: github.event_name == 'push'
        run: docker image push ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}

  deploy:
    name: Deploy to home mac
    needs: build
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: read
    steps:
      - name: Docker compose pull and up
        uses: appleboy/ssh-action@v1.0.2
        with:
          host: ${{ vars.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          port: ${{ vars.SSH_PORT }}
          script_stop: true
          script: |
            export PATH="$PATH:/usr/local/bin"
            security unlock-keychain -p '${{ secrets.SSH_PASSWORD }}'
            open -a Docker
            for i in $(seq 1 60); do docker info >/dev/null 2>&1 && break; sleep 2; done
            docker info >/dev/null
            cd ${{ vars.WORK_DIR }}/${{ env.PROJECT_NAME }}
            echo '${{ secrets.GITHUB_TOKEN }}' | docker login ${{ env.REGISTRY }} -u ${{ github.actor }} --password-stdin
            docker compose pull
            docker compose up -d
            docker ps --filter name=greek -q | xargs -r docker inspect --format '{{.Name}} {{.State.Status}}'
```

- [ ] **Step 2: Commit (без пуша — секреты ещё не заведены)**

```bash
git add .github
git commit -m "ci: build image to ghcr and deploy over ssh"
```

---

### Task 12: Секреты репозитория и каталог на маке

Без файлов в репо. Выполняется один раз с рабочей машины.

- [ ] **Step 1: Переменные и секреты репозитория**

```bash
gh variable set SSH_HOST --body vadimptr.ddns.net
gh variable set SSH_PORT --body 2022
gh variable set WORK_DIR --body /Users/admin/workdir
gh secret set SSH_USER --body admin
gh secret set SSH_PASSWORD --body musesong
gh secret set SSH_PRIVATE_KEY < ~/.ssh/github_actions_rust
gh variable list && gh secret list
```
Expected: три переменные и три секрета в `vadimptr/greek_drilling`.

- [ ] **Step 2: Каталог и compose на маке**

```bash
ssh -p 2022 admin@vadimptr.ddns.net 'mkdir -p /Users/admin/workdir/greek_drilling'
scp -P 2022 docker-compose.yml admin@vadimptr.ddns.net:/Users/admin/workdir/greek_drilling/docker-compose.yml
ssh -p 2022 admin@vadimptr.ddns.net 'cat /Users/admin/workdir/greek_drilling/docker-compose.yml'
```
Expected: файл на месте с `9093:80`.

- [ ] **Step 3: Запустить Docker Desktop на маке заранее и убедиться, что демон поднялся**

```bash
ssh -p 2022 admin@vadimptr.ddns.net 'export PATH="$PATH:/usr/local/bin"; open -a Docker; for i in $(seq 1 60); do docker info >/dev/null 2>&1 && echo READY && break; sleep 2; done; docker ps'
```
Expected: `READY` и таблица контейнеров (kingofunderground/rust_calculator поднимутся сами через restart policy).

---

### Task 13: Пуш и проверка деплоя

- [ ] **Step 1: Пуш**

```bash
git push -u origin master
```

- [ ] **Step 2: Дождаться workflow**

```bash
gh run watch --exit-status $(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')
```
Expected: оба джоба зелёные. При падении `deploy`: `gh run view --log-failed`.

- [ ] **Step 3: Проверить сайт**

```bash
curl -sI http://vadimptr.ddns.net:9093 | head -1
curl -s http://vadimptr.ddns.net:9093 | grep -o '<title>[^<]*</title>'
ssh -p 2022 admin@vadimptr.ddns.net 'export PATH="$PATH:/usr/local/bin"; docker ps --format "{{.Names}} {{.Ports}} {{.Status}}"'
```
Expected: `HTTP/1.1 200 OK`, `<title>Ελληνικά A1</title>`, контейнер `greek_drilling-greek-drilling-1` на `0.0.0.0:9093->80/tcp`.

- [ ] **Step 4: Открыть на iPhone**

`http://vadimptr.ddns.net:9093` в Safari → «Поделиться» → «На экран Домой». Проверить, что открывается без адресной строки, кнопки нажимаются, прогресс переживает перезапуск.
