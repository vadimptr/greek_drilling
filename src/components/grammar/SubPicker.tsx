import { useState } from 'react'
import { lessonsUpTo } from '../../data/grammar'
import { AORIST_VERBS } from '../../data/aorist'
import type { GrammarSub } from '../../logic/appState'
import { LEVELS, type Level } from '../../types/word'

interface Sub {
  id: GrammarSub
  title: string
  description: (level: Level) => string
  icon: string
  minLevel: Level
}

const SUBS: Sub[] = [
  {
    id: 'lessons',
    title: 'Грамматика',
    description: (level) => `${lessonsUpTo(level).length} уроков с правилами и упражнениями`,
    icon: '📖',
    minLevel: 'A1',
  },
  { id: 'nouns', title: 'Склонение', description: () => 'Род, падеж и число существительных', icon: '🔠', minLevel: 'A1' },
  { id: 'aorist', title: 'Аорист', description: () => `Прошедшее время: правила и ${AORIST_VERBS.length} глаголов`, icon: '⏪', minLevel: 'A2' },
]

export function subsFor(level: Level): Sub[] {
  return SUBS.filter((s) => LEVELS.indexOf(s.minLevel) <= LEVELS.indexOf(level))
}

interface Props {
  value: GrammarSub
  level: Level
  onChange: (sub: GrammarSub) => void
}

/** Выпадающий выбор подраздела вкладки «Грамматика». */
export function SubPicker({ value, level, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const subs = subsFor(level)
  const current = subs.find((s) => s.id === value) ?? subs[0]
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
            {subs.map((s) => (
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
                  <span className="sub-option-desc">{s.description(level)}</span>
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
