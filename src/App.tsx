import { useEffect, useState } from 'react'
import './App.css'
import { LESSONS, LESSON_IDS } from './data/grammar'
import { WORDS } from './data/words'
import { initialAppState, loadApp, saveApp, type AppState, type Tab } from './logic/appState'
import { canSpeak } from './logic/speech'
import { initialState as initialWords } from './logic/state'
import type { Direction } from './types/word'
import { Header, type Stat } from './components/Header'
import { SettingsSheet } from './components/SettingsSheet'
import { TabBar } from './components/TabBar'
import { GrammarScreen } from './screens/GrammarScreen'
import { MockScreen } from './screens/MockScreen'
import { WordsScreen } from './screens/WordsScreen'

const speechAvailable = canSpeak()

export default function App() {
  const [app, setApp] = useState<AppState>(() => {
    const loaded = loadApp(localStorage, WORDS, LESSON_IDS)
    // ?tab=grammar|mock|words — открыть нужную вкладку по ссылке
    const param = new URLSearchParams(window.location.search).get('tab')
    const tab: Tab | null = param === 'grammar' || param === 'mock' || param === 'words' ? param : null
    return tab ? { ...loaded, tab } : loaded
  })
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    saveApp(localStorage, app)
  }, [app])

  const setTab = (tab: Tab) => setApp((a) => ({ ...a, tab }))
  const changeDirection = (direction: Direction) => setApp((a) => ({ ...a, words: { ...a.words, direction } }))
  const changeAutoSpeak = (autoSpeak: boolean) => setApp((a) => ({ ...a, words: { ...a.words, autoSpeak } }))
  const resetAll = () => {
    setApp((a) => ({ ...initialAppState(), tab: a.tab, words: initialWords(a.words.direction, a.words.autoSpeak) }))
    setSettingsOpen(false)
  }

  let left: Stat
  let right: Stat
  let subtitle: string
  let progress: number | null

  if (app.tab === 'words') {
    left = { icon: '⚡', value: app.words.score, label: 'Очки', bump: true }
    right = { icon: '🏆', value: app.words.bestStreak, label: 'Лучший стрик' }
    subtitle = `Выучено ${app.words.learned.length} / ${WORDS.length} · слабых ${Object.keys(app.words.weak).length}`
    progress = app.words.learned.length / WORDS.length
  } else if (app.tab === 'grammar') {
    left = { icon: '⚡', value: app.grammar.score, label: 'Очки', bump: true }
    right = { icon: '🏆', value: app.grammar.bestStreak, label: 'Лучший стрик' }
    subtitle = `Уроков пройдено ${app.grammar.completed.length} / ${LESSONS.length}`
    progress = app.grammar.completed.length / LESSONS.length
  } else {
    const passed = app.mock.history.filter((a) => a.passed).length
    const best = app.mock.history.reduce((acc, a) => Math.max(acc, a.reading + a.language), 0)
    left = { icon: '🎓', value: `${passed}`, label: 'Сдано попыток' }
    right = { icon: '🏆', value: app.mock.history.length ? `${Math.round((best / 50) * 100)}%` : '—', label: 'Лучший результат' }
    subtitle = `Попыток: ${app.mock.history.length}`
    progress = null
  }

  return (
    <div className="app">
      <Header left={left} right={right} subtitle={subtitle} progress={progress} onSettings={() => setSettingsOpen(true)} />

      <div className="screen">
        {app.tab === 'words' && (
          <WordsScreen state={app.words} onChange={(words) => setApp((a) => ({ ...a, words }))} />
        )}
        {app.tab === 'grammar' && (
          <GrammarScreen state={app.grammar} onChange={(grammar) => setApp((a) => ({ ...a, grammar }))} />
        )}
        {app.tab === 'mock' && <MockScreen state={app.mock} onChange={(mock) => setApp((a) => ({ ...a, mock }))} />}
      </div>

      <TabBar tab={app.tab} onChange={setTab} />

      <SettingsSheet
        open={settingsOpen}
        direction={app.words.direction}
        autoSpeak={app.words.autoSpeak}
        canSpeak={speechAvailable}
        onDirection={changeDirection}
        onAutoSpeak={changeAutoSpeak}
        onReset={resetAll}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  )
}
