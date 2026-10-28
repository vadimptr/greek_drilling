import type { GrammarSub, Tab } from './appState'
import { CITY_PATH } from './city/name'

export interface Route {
  tab: Tab
  sub?: GrammarSub
}

const PATHS: Record<Tab, string> = {
  words: '/words',
  grammar: '/grammar',
  speak: '/speak',
  spell: '/spell',
  mock: '/mock',
  city: CITY_PATH,
}

const TABS = Object.keys(PATHS) as Tab[]

export function pathFor(tab: Tab, sub: GrammarSub): string {
  return tab === 'grammar' && sub !== 'lessons' ? `/grammar/${sub}` : PATHS[tab]
}

export function parseRoute(pathname: string, search: string): Route | null {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/') {
    const tab = TABS.find((t) => t === new URLSearchParams(search).get('tab'))
    return tab ? { tab } : null
  }
  const sub = /^\/grammar\/(nouns|aorist)$/.exec(path)?.[1] as GrammarSub | undefined
  if (sub) return { tab: 'grammar', sub }
  const tab = TABS.find((t) => PATHS[t] === path)
  if (!tab) return null
  return tab === 'grammar' ? { tab, sub: 'lessons' } : { tab }
}
