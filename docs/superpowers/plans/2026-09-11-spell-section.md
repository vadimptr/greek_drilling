# Раздел «Письмо» — план

Спека: docs/superpowers/specs/2026-09-11-spell-section-design.md. TDD для логики.

1. `src/logic/spell.ts` + `spell.test.ts`: graphemes, baseLetter/sameAccent, confusablesOf, targetPositions, makeSpellTask, checkSpell, SpellState.
2. `appState.ts` (+тест): поле `spell`, Tab 'spell', initial/parse/reset.
3. UI: `TabBar` 5 колонок, `screens/SpellScreen.tsx`, `App.tsx` шапка/экран/сброс, CSS (клетки, варианты, анимации).
4. Проверка: vitest, tsc, build, puppeteer-скриншоты трёх типов заданий и ошибки; коммит, push, деплой.
