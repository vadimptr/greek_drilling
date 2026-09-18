import { useState } from 'react'
import type { GrammarSub } from '../../logic/appState'

export const SUBS: { id: GrammarSub; title: string; description: string; icon: string }[] = [
  { id: 'lessons', title: 'Грамматика', description: '30 уроков с правилами и упражнениями', icon: '📖' },
  { id: 'nouns', title: 'Склонение', description: 'Род, падеж и число существительных', icon: '🔠' },
]

interface Props {
  value: GrammarSub
  onChange: (sub: GrammarSub) => void
}

/** Выпадающий выбор подраздела вкладки «Грамматика». */
export function SubPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const current = SUBS.find((s) => s.id === value) ?? SUBS[0]
  return (
    <>
      <button className="sub-picker" onClick={() => setOpen(true)} aria-haspopup="menu" aria-expanded={open}>
        <span>{current.icon}</span>
        <span className="sub-picker-title">{current.title}</span>
        <span className="sub-picker-caret">▾</span>
      </button>
      {open && (
        <div className="sheet-backdrop" onClick={() => setOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="menu">
            <h2 className="sheet-title">Раздел</h2>
            {SUBS.map((s) => (
              <button
                key={s.id}
                className={s.id === value ? 'sub-option sub-option-active' : 'sub-option'}
                role="menuitemradio"
                aria-checked={s.id === value}
                onClick={() => {
                  onChange(s.id)
                  setOpen(false)
                }}
              >
                <span className="sub-option-icon">{s.icon}</span>
                <span className="sub-option-body">
                  <span className="sub-option-title">{s.title}</span>
                  <span className="sub-option-desc">{s.description}</span>
                </span>
                {s.id === value && <span className="sub-option-check">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
