import { useEffect, useState } from 'react'
import './App.css'
import { lessonsUpTo } from './data/grammar'
import { wordPool } from './data/levels'
import { variantLevel } from './data/mock'
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
import { SubPicker, subsFor } from './components/grammar/SubPicker'
import { WordsScreen } from './screens/WordsScreen'
import { CityScreen } from './screens/CityScreen'
import { cityAccess } from './logic/city/api'
import { CITY_NAME, CITY_PATH } from './logic/city/name'

const speechAvailable = canSpeak()

const boot = initialLoad()

export default function App() {
  const [app, setApp] = useState<AppState>(() => {
    const loaded = boot.app
    // ?tab=grammar|mock|words|speak|spell — открыть нужную вкладку по ссылке
    if (window.location.pathname === CITY_PATH) {
      window.history.replaceState(null, '', '/' + window.location.hash)
      return { ...loaded, tab: 'city' }
    }
    const param = new URLSearchParams(window.location.search).get('tab')
    const tabs: Tab[] = ['words', 'grammar', 'speak', 'spell', 'mock', 'city']
    const tab = tabs.find((t) => t === param) ?? null
    return tab ? { ...loaded, tab } : loaded
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const account = useAccount(app, setApp, boot.user)
  const [cityAllowed, setCityAllowed] = useState<boolean | null>(null)
  const [cityTotal, setCityTotal] = useState(0)
  const [storyMs, setStoryMs] = useState(40_000)

  useEffect(() => {
    let alive = true
    if (!account.user) {
      setCityAllowed(false)
      return
    }
    setCityAllowed(null)
    cityAccess().then((r) => {
      if (!alive) return
      setCityAllowed(r.allowed)
      setCityTotal(r.total)
      setStoryMs(r.storyMs)
    })
    return () => {
      alive = false
    }
  }, [account.user])

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
      citySpeed: a.citySpeed,
    }))
    setSettingsOpen(false)
  }

  const level = app.words.level
  const grammarSub = subsFor(level).some((s) => s.id === app.grammarSub) ? app.grammarSub : 'lessons'

  let left: Stat
  let right: Stat
  let subtitle: string
  let progress: number | null

  if (app.tab === 'words') {
    left = { icon: '⚡', value: app.words.score, label: 'Очки', bump: true }
    right = { icon: '🏆', value: app.words.bestStreak, label: 'Лучший стрик' }
    const pool = wordPool(level)
    const learned = pool.filter((w) => app.words.learned.includes(w.id)).length
    const weak = pool.filter((w) => w.id in app.words.weak).length
    subtitle = `${level} · выучено ${learned} / ${pool.length} · слабых ${weak}`
    progress = learned / pool.length
  } else if (app.tab === 'grammar' && grammarSub === 'nouns') {
    left = { icon: '⚡', value: app.nouns.score, label: 'Очки', bump: true }
    right = { icon: '🏆', value: app.nouns.bestStreak, label: 'Лучший стрик' }
    subtitle = `Склонение: усвоено ${app.nouns.learned.length} / ${NOUNS.length} · слабых ${Object.keys(app.nouns.weak).length}`
    progress = app.nouns.learned.length / NOUNS.length
  } else if (app.tab === 'grammar' && grammarSub === 'aorist') {
    left = { icon: '⚡', value: app.aorist.score, label: 'Очки', bump: true }
    right = { icon: '🏆', value: app.aorist.bestStreak, label: 'Лучший стрик' }
    subtitle = `Аорист: усвоено ${app.aorist.learned.length} / ${AORIST_VERBS.length} · слабых ${Object.keys(app.aorist.weak).length}`
    progress = app.aorist.learned.length / AORIST_VERBS.length
  } else if (app.tab === 'grammar') {
    left = { icon: '⚡', value: app.grammar.score, label: 'Очки', bump: true }
    right = { icon: '🏆', value: app.grammar.bestStreak, label: 'Лучший стрик' }
    const lessons = lessonsUpTo(level)
    const passed = lessons.filter((l) => app.grammar.completed.includes(l.id)).length
    subtitle = `${level} · уроков пройдено ${passed} / ${lessons.length}`
    progress = passed / lessons.length
  } else if (app.tab === 'speak') {
    left = { icon: '⚡', value: app.speak.score, label: 'Очки', bump: true }
    right = { icon: '🏆', value: app.speak.bestStreak, label: 'Лучший стрик' }
    const pool = wordPool(level)
    const learned = pool.filter((w) => app.speak.learned.includes(w.id)).length
    const weak = pool.filter((w) => w.id in app.speak.weak).length
    subtitle = `${level} · произнесено ${learned} / ${pool.length} · слабых ${weak}`
    progress = learned / pool.length
  } else if (app.tab === 'spell') {
    left = { icon: '⚡', value: app.spell.score, label: 'Очки', bump: true }
    right = { icon: '🏆', value: app.spell.bestStreak, label: 'Лучший стрик' }
    const pool = wordPool(level)
    const learned = pool.filter((w) => app.spell.learned.includes(w.id)).length
    const weak = pool.filter((w) => w.id in app.spell.weak).length
    subtitle = `${level} · написано ${learned} / ${pool.length} · слабых ${weak}`
    progress = learned / pool.length
  } else if (app.tab === 'city') {
    left = { icon: '⭐', value: cityTotal, label: 'Очки за факты', bump: true }
    right = { icon: '🗣️', value: level, label: 'Уровень' }
    subtitle = `${CITY_NAME} · жители говорят на уровне ${level}`
    progress = null
  } else {
    const history = app.mock.history.filter((a) => variantLevel(a.variantId) === level)
    const passed = history.filter((a) => a.passed).length
    const best = history.reduce((acc, a) => Math.max(acc, a.reading + a.language), 0)
    left = { icon: '🎓', value: `${passed}`, label: 'Сдано попыток' }
    right = { icon: '🏆', value: history.length ? `${Math.round((best / 50) * 100)}%` : '—', label: 'Лучший результат' }
    subtitle = `${level} · попыток: ${history.length}`
    progress = null
  }

  return (
    <div className={app.tab === 'city' ? 'app app-wide' : 'app'}>
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
            <SubPicker value={grammarSub} level={level} onChange={setGrammarSub} />
            <div className="hub-body">
              {grammarSub === 'lessons' && (
                <GrammarScreen state={app.grammar} level={level} onChange={(grammar) => setApp((a) => ({ ...a, grammar }))} />
              )}
              {grammarSub === 'nouns' && (
                <NounsScreen state={app.nouns} onChange={(nouns) => setApp((a) => ({ ...a, nouns }))} />
              )}
              {grammarSub === 'aorist' && (
                <AoristScreen state={app.aorist} onChange={(aorist) => setApp((a) => ({ ...a, aorist }))} />
              )}
            </div>
          </div>
        )}
        {app.tab === 'speak' && (
          <SpeakScreen key={level} state={app.speak} hint={app.speakHint} words={wordPool(level)} onChange={(speak) => setApp((a) => ({ ...a, speak }))} />
        )}
        {app.tab === 'spell' && (
          <SpellScreen key={level} state={app.spell} words={wordPool(level)} onChange={(spell) => setApp((a) => ({ ...a, spell }))} />
        )}
        {app.tab === 'city' && (
          <CityScreen key={account.user ?? ''} allowed={cityAllowed} signedIn={!!account.user} level={level} speed={app.citySpeed} storyMs={storyMs} onSignIn={() => setAccountOpen(true)} onTotal={setCityTotal} />
        )}
        {app.tab === 'mock' && <MockScreen key={level} state={app.mock} level={level} onChange={(mock) => setApp((a) => ({ ...a, mock }))} />}
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
        citySpeed={app.citySpeed}
        onCitySpeed={(citySpeed) => setApp((a) => ({ ...a, citySpeed }))}
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
