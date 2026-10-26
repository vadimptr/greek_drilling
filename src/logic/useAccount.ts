import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { LESSON_IDS } from '../data/grammar'
import { ALL_WORDS } from '../data/levels'
import { logout, me, saveProgress, type Session } from './account'
import {
  APP_STORAGE_KEY,
  initialAppState,
  loadApp,
  loadUserCache,
  parseRemote,
  saveApp,
  serializeApp,
  USER_CACHE_KEY,
  USER_HINT_KEY,
  type AppState,
} from './appState'
import { hasProgress, mergeApp } from './merge'
import { initialState as initialWords } from './state'

const PUSH_DELAY = 1500

function readHint(): string | null {
  try {
    return localStorage.getItem(USER_HINT_KEY)
  } catch {
    return null
  }
}

function writeHint(name: string | null): void {
  try {
    if (name === null) {
      localStorage.removeItem(USER_HINT_KEY)
      localStorage.removeItem(USER_CACHE_KEY)
    } else {
      localStorage.setItem(USER_HINT_KEY, name)
    }
  } catch {
    return
  }
}

function settingsOnly(s: AppState): AppState {
  return {
    ...initialAppState(),
    tab: s.tab,
    words: initialWords(s.words.direction, s.words.autoSpeak, s.words.level),
    speakHint: s.speakHint,
    grammarSub: s.grammarSub,
  }
}

export function initialLoad(): { user: string | null; app: AppState } {
  const user = readHint()
  return { user, app: user ? loadUserCache(localStorage, ALL_WORDS, LESSON_IDS) : loadApp(localStorage, ALL_WORDS, LESSON_IDS) }
}

export function useAccount(app: AppState, setApp: Dispatch<SetStateAction<AppState>>, initialUser: string | null) {
  const [user, setUser] = useState<string | null>(initialUser)
  const synced = useRef<string | null>(null)
  const pending = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const appRef = useRef(app)
  appRef.current = app

  const flush = useCallback((keepalive = false) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const body = pending.current
    if (body === null) return
    pending.current = null
    saveProgress(JSON.parse(body), keepalive).then((ok) => {
      if (ok) synced.current = body
    })
  }, [])

  const adopt = useCallback(
    (session: Session, local: AppState) => {
      const remote = parseRemote(session.state, ALL_WORDS, LESSON_IDS)
      const next = hasProgress(local) ? mergeApp(local, remote) : (remote ?? local)
      synced.current = remote ? serializeApp(remote) : null
      saveApp(localStorage, settingsOnly(local), APP_STORAGE_KEY)
      writeHint(session.name)
      setUser(session.name)
      setApp({ ...next, tab: local.tab })
    },
    [setApp],
  )

  useEffect(() => {
    let cancelled = false
    me().then((r) => {
      if (cancelled || r === 'offline') return
      if (r === 'anonymous') {
        if (readHint() !== null) {
          writeHint(null)
          setUser(null)
          setApp(loadApp(localStorage, ALL_WORDS, LESSON_IDS))
        }
        return
      }
      if (readHint() === null) {
        adopt(r, appRef.current)
        return
      }
      const remote = parseRemote(r.state, ALL_WORDS, LESSON_IDS)
      writeHint(r.name)
      setUser(r.name)
      if (remote) {
        synced.current = serializeApp(remote)
        setApp((a) => ({ ...remote, tab: a.tab }))
      }
    })
    return () => {
      cancelled = true
    }
  }, [adopt, setApp])

  useEffect(() => {
    if (user === null) {
      saveApp(localStorage, app)
      return
    }
    saveApp(localStorage, app, USER_CACHE_KEY)
    const body = serializeApp(app)
    if (body === synced.current) return
    pending.current = body
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => flush(), PUSH_DELAY)
  }, [app, user, flush])

  useEffect(() => {
    const onHide = () => flush(true)
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }, [flush])

  const signIn = useCallback((session: Session) => adopt(session, appRef.current), [adopt])

  const signOut = useCallback(async () => {
    flush(true)
    await logout()
    writeHint(null)
    synced.current = null
    setUser(null)
    setApp(loadApp(localStorage, ALL_WORDS, LESSON_IDS))
  }, [flush, setApp])

  return { user, signIn, signOut }
}
