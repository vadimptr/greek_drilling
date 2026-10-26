import { useState } from 'react'
import './App.css'
import { LESSONS } from './data/grammar'
import { WORDS } from './data/words'
import { wordPool } from './data/levels'
import { initialAppState, type AppState, type GrammarSub, type SpeakHint, type Tab } from './logic/appState'
import { NOUNS } from './data/nouns'
import { canSpeak } from './logic/speech'
import { initialState as initialWords } from './logic/state'
import type { Direction, Level } from './types/word'
import { Header, type Stat } from './components/Header'
import { SettingsSheet } from './components/SettingsSheet'
import { AccountSheet } from './components/AccountSheet'
import { initialLoad, useAccount } from './logic/useAccount'
import { TabBar } from './components/TabBar'
import { GrammarScreen } from './screens/GrammarScreen'
import { MockScreen } from './screens/MockScreen'
import { SpeakScreen } from './screens/SpeakScreen'
import { SpellScreen } from './screens/SpellScreen'
import { NounsScreen } from './screens/NounsScreen'
import { AoristScreen } from './screens/AoristScreen'
import { AORIST_VERBS } from './data/aorist'
import { SubPicker } from './components/grammar/SubPicker'
import { WordsScreen } from './screens/WordsScreen'

const speechAvailable = canSpeak()

const boot = initialLoad()

export default function App() {
  const [app, setApp] = useState<AppState>(() => {
    const loaded = boot.app
    // ?tab=grammar|mock|words|speak|spell — открыть нужную вкладку по ссылке
    const param = new URLSearchParams(window.location.search).get('tab')
    const tabs: Tab[] = ['words', 'grammar', 'speak', 'spell', 'mock']
    const tab = tabs.find((t) => t === param) ?? null
    return tab ? { ...loaded, tab } : loaded
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const account = useAccount(app, setApp, boot.user)

  const setTab = (tab: Tab) => setApp((a) => ({ ...a, tab }))
  const changeDirection = (direction: Direction) => setApp((a) => ({ ...a, words: { ...a.words, direction } }))
  const changeAutoSpeak = (autoSpeak: boolean) => setApp((a) => ({ ...a, words: { ...a.words, autoSpeak } }))
  const changeLevel = (level: Level) => setApp((a) => ({ ...a, words: { ...a.words, level } }))
  const changeSpeakHint = (speakHint: SpeakHint) => setApp((a) => ({ ...a, speakHint }))
  const setGrammarSub = (grammarSub: GrammarSub) => setApp((a) => ({ ...a, grammarSub }))
  const resetAll = () => {
    setApp((a) => ({
      ...initialAppState(),
      tab: a.tab,
      words: initialWords(a.words.direction, a.words.autoSpeak, a.words.level),
      speakHint: a.speakHint,
      grammarSub: a.grammarSub,
    }))
    setSettingsOpen(false)
  }

  let left: Stat
  let right: Stat
  let subtitle: string
  let progress: number | null

  if (app.tab === 'words') {
    left = { icon: '⚡', value: app.words.score, label: 'Очки', bump: true }
    right = { icon: '🏆', value: app.words.bestStreak, label: 'Лучший стрик' }
    const pool = wordPool(app.words.level)
    const learned = pool.filter((w) => app.words.learned.includes(w.id)).length
    const weak = pool.filter((w) => w.id in app.words.weak).length
    subtitle = `${app.words.level} · выучено ${learned} / ${pool.length} · слабых ${weak}`
    progress = learned / pool.length
  } else if (app.tab === 'grammar' && app.grammarSub === 'nouns') {
    left = { icon: '⚡', value: app.nouns.score, label: 'Очки', bump: true }
    right = { icon: '🏆', value: app.nouns.bestStreak, label: 'Лучший стрик' }
    subtitle = `Склонение: усвоено ${app.nouns.learned.length} / ${NOUNS.length} · слабых ${Object.keys(app.nouns.weak).length}`
    progress = app.nouns.learned.length / NOUNS.length
  } else if (app.tab === 'grammar' && app.grammarSub === 'aorist') {
    left = { icon: '⚡', value: app.aorist.score, label: 'Очки', bump: true }
    right = { icon: '🏆', value: app.aorist.bestStreak, label: 'Лучший стрик' }
    subtitle = `Аорист: усвоено ${app.aorist.learned.length} / ${AORIST_VERBS.length} · слабых ${Object.keys(app.aorist.weak).length}`
    progress = app.aorist.learned.length / AORIST_VERBS.length
  } else if (app.tab === 'grammar') {
    left = { icon: '⚡', value: app.grammar.score, label: 'Очки', bump: true }
    right = { icon: '🏆', value: app.grammar.bestStreak, label: 'Лучший стрик' }
    subtitle = `Уроков пройдено ${app.grammar.completed.length} / ${LESSONS.length}`
    progress = app.grammar.completed.length / LESSONS.length
  } else if (app.tab === 'speak') {
    left = { icon: '⚡', value: app.speak.score, label: 'Очки', bump: true }
    right = { icon: '🏆', value: app.speak.bestStreak, label: 'Лучший стрик' }
    subtitle = `Произнесено ${app.speak.learned.length} / ${WORDS.length} · слабых ${Object.keys(app.speak.weak).length}`
    progress = app.speak.learned.length / WORDS.length
  } else if (app.tab === 'spell') {
    left = { icon: '⚡', value: app.spell.score, label: 'Очки', bump: true }
    right = { icon: '🏆', value: app.spell.bestStreak, label: 'Лучший стрик' }
    subtitle = `Написано ${app.spell.learned.length} / ${WORDS.length} · слабых ${Object.keys(app.spell.weak).length}`
    progress = app.spell.learned.length / WORDS.length
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
      <Header left={left} right={right} subtitle={subtitle} progress={progress} onSettings={() => setSettingsOpen(true)}
        user={account.user}
        onAccount={() => setAccountOpen(true)}
      />

      <div className="screen">
        {app.tab === 'words' && (
          <WordsScreen state={app.words} onChange={(words) => setApp((a) => ({ ...a, words }))} />
        )}
        {app.tab === 'grammar' && (
          <div className="grammar-hub">
            <SubPicker value={app.grammarSub} onChange={setGrammarSub} />
            <div className="hub-body">
              {app.grammarSub === 'lessons' && (
                <GrammarScreen state={app.grammar} onChange={(grammar) => setApp((a) => ({ ...a, grammar }))} />
              )}
              {app.grammarSub === 'nouns' && (
                <NounsScreen state={app.nouns} onChange={(nouns) => setApp((a) => ({ ...a, nouns }))} />
              )}
              {app.grammarSub === 'aorist' && (
                <AoristScreen state={app.aorist} onChange={(aorist) => setApp((a) => ({ ...a, aorist }))} />
              )}
            </div>
          </div>
        )}
        {app.tab === 'speak' && (
          <SpeakScreen state={app.speak} hint={app.speakHint} onChange={(speak) => setApp((a) => ({ ...a, speak }))} />
        )}
        {app.tab === 'spell' && (
          <SpellScreen state={app.spell} onChange={(spell) => setApp((a) => ({ ...a, spell }))} />
        )}
        {app.tab === 'mock' && <MockScreen state={app.mock} onChange={(mock) => setApp((a) => ({ ...a, mock }))} />}
      </div>

      <TabBar tab={app.tab} onChange={setTab} />

      <AccountSheet
        open={accountOpen}
        user={account.user}
        onSignIn={account.signIn}
        onSignOut={() => void account.signOut()}
        onClose={() => setAccountOpen(false)}
      />

      <SettingsSheet
        open={settingsOpen}
        direction={app.words.direction}
        autoSpeak={app.words.autoSpeak}
        level={app.words.level}
        canSpeak={speechAvailable}
        speakHint={app.speakHint}
        onDirection={changeDirection}
        onAutoSpeak={changeAutoSpeak}
        onLevel={changeLevel}
        onSpeakHint={changeSpeakHint}
        onReset={resetAll}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  )
}
