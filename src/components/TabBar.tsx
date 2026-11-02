import { CITY_NAMES, type Lang } from '../logic/city/name'
import { useT, type UiKey } from '../logic/i18n'
import { GROUP_ICONS, groupOf, mobileTabs, NAV_ICONS, navGroups, type NavGroup, type NavId } from '../logic/nav'
import brand from '../assets/brand.png'

interface Props {
  current: NavId
  learn: Lang
  lastInGroup: Partial<Record<NavGroup, NavId>>
  onChange: (id: NavId) => void
}

const GROUPS: NavGroup[] = ['vocab', 'grammar', 'practice']

export function TabBar({ current, learn, lastInGroup, onChange }: Props) {
  const t = useT()
  const label = (id: NavId) => (id === 'city' ? CITY_NAMES[learn] : t(`nav.${id}` as UiKey))
  const currentGroup = groupOf(current)
  const item = (id: NavId) => (
    <button
      key={id}
      className={id === current ? 'tab tab-active' : 'tab'}
      onClick={() => onChange(id)}
      aria-current={id === current ? 'page' : undefined}
    >
      <span className="tab-icon">{NAV_ICONS[id]}</span>
      <span className="tab-label">{label(id)}</span>
    </button>
  )
  return (
    <nav className="tabbar" aria-label={t('tab.aria')}>
      <div className="brand" aria-hidden="true">
        <img className="brand-logo" src={brand} alt="" draggable={false} />
        <span className="brand-name">Language Drilling</span>
      </div>
      <div className="nav-desktop">
        {navGroups(learn).map((g) => (
          <div key={g.id} className="nav-group">
            {learn === 'el' && <div className="nav-group-title">{t(`group.${g.id}` as UiKey)}</div>}
            {g.items.map(item)}
          </div>
        ))}
      </div>
      <div className="nav-mobile">
        {mobileTabs(learn).map((entry) => {
          if (!GROUPS.includes(entry as NavGroup) || entry === 'practice') return item(entry as NavId)
          const g = entry as NavGroup
          const active = currentGroup === g
          const first = navGroups(learn).find((x) => x.id === g)!.items[0]
          return (
            <button
              key={g}
              className={active ? 'tab tab-active' : 'tab'}
              onClick={() => onChange(lastInGroup[g] ?? first)}
              aria-current={active ? 'page' : undefined}
            >
              <span className="tab-icon">{GROUP_ICONS[g]}</span>
              <span className="tab-label">{t(`group.${g}` as UiKey)}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
