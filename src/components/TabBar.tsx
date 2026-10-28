import type { Tab } from '../logic/appState'

interface Props {
  tab: Tab
  city: string | null
  onChange: (tab: Tab) => void
}

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'words', icon: '🔤', label: 'Слова' },
  { id: 'grammar', icon: '📖', label: 'Грамматика' },
  { id: 'speak', icon: '🎤', label: 'Речь' },
  { id: 'spell', icon: '✍️', label: 'Письмо' },
  { id: 'mock', icon: '📝', label: 'Тест' },
]

export function TabBar({ tab, city, onChange }: Props) {
  const tabs = city ? [...TABS, { id: 'city' as Tab, icon: '🌊', label: city }] : TABS
  return (
    <nav className="tabbar" aria-label="Разделы">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={t.id === tab ? 'tab tab-active' : 'tab'}
          onClick={() => onChange(t.id)}
          aria-current={t.id === tab ? 'page' : undefined}
        >
          <span className="tab-icon">{t.icon}</span>
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
