import type { Tab } from '../logic/appState'

interface Props {
  tab: Tab
  onChange: (tab: Tab) => void
}

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'words', icon: '🔤', label: 'Слова' },
  { id: 'grammar', icon: '📖', label: 'Грамматика' },
  { id: 'speak', icon: '🎤', label: 'Речь' },
  { id: 'mock', icon: '📝', label: 'Тест' },
]

export function TabBar({ tab, onChange }: Props) {
  return (
    <nav className="tabbar" aria-label="Разделы">
      {TABS.map((t) => (
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
