# Grammar & Mock Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить вкладки «Грамматика» (30 уроков A1 с упражнениями) и «Тест» (мок-экзамен ΚΕΓ A1: чтение + грамматика/лексика) с раздельными очками и единым хранилищем v2.

**Architecture:** Чистая логика в `src/logic` (lesson.ts, mock.ts, appState.ts) с тестами; данные в `src/data/grammar/*` и `src/data/mock/*` с валидирующими тестами; React-экраны по разделам в `src/screens`, общий TabBar. Хранилище `greek_drilling.v2` с миграцией из v1.

**Tech Stack:** тот же (Vite, React 18, TS strict, Vitest).

Спека: `docs/superpowers/specs/2026-09-09-grammar-and-mock-design.md`.

---

## Структура файлов

| Файл | Ответственность |
|---|---|
| `src/types/grammar.ts`, `src/types/mock.ts` | типы данных и состояния разделов |
| `src/logic/lesson.ts` (+test) | очередь урока, ответ, завершение |
| `src/logic/mock.ts` (+test) | подсчёт баллов, порог |
| `src/logic/appState.ts` (+test) | `AppState`, initial, (де)сериализация v2, миграция v1 |
| `src/logic/storage.ts` | переключить на v2 через appState |
| `src/data/grammar/index.ts`, `lessons-*.ts` (+test) | уроки |
| `src/data/mock/index.ts`, `variant1..3.ts` (+test) | варианты |
| `src/components/TabBar.tsx` | вкладки |
| `src/screens/WordsScreen.tsx` | текущий экран слов (вынос из App) |
| `src/screens/GrammarScreen.tsx`, `src/components/grammar/*` | список, объяснение, упражнение |
| `src/screens/MockScreen.tsx`, `src/components/mock/*` | старт, задания, часть Б, результат, таймер |
| `src/App.tsx` | AppState, вкладки, настройки, сохранение |

---

### Task 1: Типы и логика урока (TDD)

- [ ] `src/types/grammar.ts` — типы из спеки (`GrammarQuestion`, `LessonSection`, `Lesson`, `GrammarState`).
- [ ] `src/logic/lesson.test.ts`: startLesson перемешивает и кладёт все id; правильный ответ убирает голову очереди и +1 очко; неправильный переносит в конец и сбрасывает очки; единственный вопрос при ошибке остаётся; пустая очередь → completed, active=null; повторное прохождение не дублирует completed; abandonLesson.
- [ ] `src/logic/lesson.ts`:

```ts
export function initialGrammarState(): GrammarState
export function startLesson(state: GrammarState, lesson: Lesson, rng?: Rng): GrammarState
export function currentQuestionId(state: GrammarState): string | null
export function answerLesson(state: GrammarState, correct: boolean): GrammarState
export function abandonLesson(state: GrammarState): GrammarState
```

- [ ] Тесты зелёные, commit `feat: grammar lesson state`.

### Task 2: Типы и логика мок-теста (TDD)

- [ ] `src/types/mock.ts` — типы из спеки + `ReadingAnswers`, `LanguageAnswers`, `MockAttempt`, `MockState`.
- [ ] `src/logic/mock.test.ts`: tf считает 1/0; match по индексам; mc; gap; null не считается; total = сумма; isPassed на границе 60% (15/25 сдано, 14/25 нет); `emptyReadingAnswers(variant)` даёт нужные длины; `recordAttempt` добавляет в history (не больше 20) и двигает nextVariant по кругу.
- [ ] `src/logic/mock.ts`.
- [ ] commit `feat: mock exam grading`.

### Task 3: AppState v2 и миграция (TDD)

- [ ] `src/logic/appState.ts`: `AppState`, `initialAppState()`, `deserializeApp(rawV2, rawV1, words)`, `serializeApp`. Валидация как в v1 (числа, массивы, id известны).
- [ ] `src/logic/storage.ts`: `loadApp(storage, words)`, `saveApp(storage, state)`; ключи `greek_drilling.v2`, старый `greek_drilling.v1` читается только при отсутствии v2.
- [ ] Тесты: миграция words из v1; порча v2 → initial; неизвестные lesson id в completed отбрасываются; tab по умолчанию words.
- [ ] commit `feat: app state v2 with migration`.

### Task 4: Данные грамматики

- [ ] `src/data/grammar/grammar.test.ts` (правила из спеки).
- [ ] Уроки 1–30 в файлах `lessons-01-10.ts`, `lessons-11-20.ts`, `lessons-21-30.ts`, сборка в `index.ts` (`LESSONS: Lesson[]`). Каждый урок: 3–6 секций объяснения, 10–14 вопросов, `explain` у каждого вопроса.
- [ ] Тесты зелёные, commit.

### Task 5: Данные мок-теста

- [ ] `src/data/mock/mock.test.ts` (правила из спеки).
- [ ] `variant1.ts`, `variant2.ts`, `variant3.ts`, `index.ts` (`VARIANTS`). Тексты в стиле официальных образцов: приглашение/объявление, анкета/профиль, письмо друга, сообщение с пропусками.
- [ ] Тесты зелёные, commit.

### Task 6: UI — каркас вкладок и вынос слов

- [ ] `TabBar.tsx`, `WordsScreen.tsx` (код из App), `App.tsx` держит `AppState`, сохраняет через `saveApp`, рендерит экран по `tab`, глобальные настройки/сброс.
- [ ] CSS: `.tabbar` внизу с safe-area, `.app` grid `auto 1fr auto auto`.
- [ ] Проверить, что слова работают как раньше; commit.

### Task 7: UI — грамматика

- [ ] `LessonList.tsx`, `LessonExplanation.tsx` (рендер секций, 🔊 у примеров), `Exercise.tsx` (кнопки, пояснение при ошибке, «Дальше»), `GrammarScreen.tsx` (режимы list / explain / exercise / done).
- [ ] Header показывает grammar.score/bestStreak и «Уроков N/30».
- [ ] commit.

### Task 8: UI — мок-тест

- [ ] `Timer.tsx` (обратный отсчёт, onExpire), `TaskTF.tsx`, `TaskMatch.tsx`, `TaskMC.tsx`, `TaskGap.tsx`, `LanguagePart.tsx`, `MockResult.tsx`, `MockScreen.tsx` (start / reading / language / result).
- [ ] commit.

### Task 9: Проверка и деплой

- [ ] `npm test`, `tsc`, `npm run build`, скриншоты трёх вкладок headless Chrome.
- [ ] push → workflow → curl 9093.
