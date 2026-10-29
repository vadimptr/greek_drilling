import { tabsFor, type Tab } from '../logic/appState'
import { CITY_NAMES, type Lang } from '../logic/city/name'
import { useT, type UiKey } from '../logic/i18n'

interface Props {
  tab: Tab
  learn: Lang
  onChange: (tab: Tab) => void
}

const ICONS: Record<Tab, string> = { words: '🔤', grammar: '📖', speak: '🎤', spell: '✍️', mock: '📝', city: '🌊' }

export function TabBar({ tab, learn, onChange }: Props) {
  const t = useT()
  const label = (id: Tab) => (id === 'city' ? CITY_NAMES[learn] : t(`tab.${id}` as UiKey))
  return (
    <nav className="tabbar" aria-label={t('tab.aria')}>
      {tabsFor(learn).map((id) => (
        <button
          key={id}
          className={id === tab ? 'tab tab-active' : 'tab'}
          onClick={() => onChange(id)}
          aria-current={id === tab ? 'page' : undefined}
        >
          <span className="tab-icon">{ICONS[id]}</span>
          <span className="tab-label">{label(id)}</span>
        </button>
      ))}
    </nav>
  )
}
