import type { GrammarSub, Tab } from './appState'
import type { Lang } from './city/name'

export type NavId = 'words' | 'speak' | 'spell' | 'lessons' | 'nouns' | 'aorist' | 'mock' | 'city'
export type NavGroup = 'vocab' | 'grammar' | 'practice'

export const NAV_ICONS: Record<NavId, string> = {
  words: '🔤',
  speak: '🎤',
  spell: '✍️',
  lessons: '📖',
  nouns: '🔠',
  aorist: '⏪',
  mock: '📝',
  city: '🌊',
}

export const GROUP_ICONS: Record<NavGroup, string> = { vocab: '🔤', grammar: '📖', practice: '🎯' }

const GROUPS: { id: NavGroup; items: NavId[] }[] = [
  { id: 'vocab', items: ['words', 'speak', 'spell'] },
  { id: 'grammar', items: ['lessons', 'nouns', 'aorist'] },
  { id: 'practice', items: ['mock', 'city'] },
]

export function navGroups(learn: Lang): { id: NavGroup; items: NavId[] }[] {
  return learn === 'el' ? GROUPS : [{ id: 'practice', items: ['city'] }]
}

export function navOf(tab: Tab, sub: GrammarSub): NavId {
  return tab === 'grammar' ? sub : tab
}

export function routeOf(id: NavId): { tab: Tab; sub?: GrammarSub } {
  return id === 'lessons' || id === 'nouns' || id === 'aorist' ? { tab: 'grammar', sub: id } : { tab: id }
}

export function groupOf(id: NavId): NavGroup {
  return GROUPS.find((g) => g.items.includes(id))!.id
}

export function mobileTabs(learn: Lang): (NavGroup | NavId)[] {
  return learn === 'el' ? ['vocab', 'grammar', 'mock', 'city'] : ['city']
}
