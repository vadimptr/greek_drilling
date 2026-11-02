import { useT, type UiKey } from '../logic/i18n'
import { navGroups, groupOf, type NavId } from '../logic/nav'
import type { Lang } from '../logic/city/name'

export function ModeSwitch({ current, learn, onChange }: { current: NavId; learn: Lang; onChange: (id: NavId) => void }) {
  const t = useT()
  const group = navGroups(learn).find((g) => g.id === groupOf(current))
  if (!group || group.id === 'practice' || group.items.length < 2) return null
  return (
    <div className={`segmented seg-${group.items.length} mode-switch`}>
      {group.items.map((id) => (
        <button key={id} className={id === current ? 'seg seg-active' : 'seg'} onClick={() => onChange(id)}>
          {t(`nav.${id}` as UiKey)}
        </button>
      ))}
    </div>
  )
}
