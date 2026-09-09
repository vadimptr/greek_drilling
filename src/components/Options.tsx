import type { Direction, Word } from '../types/word'
import { labelOf } from '../logic/options'

export interface Feedback {
  chosenId: number
  correct: boolean
}

interface Props {
  options: Word[]
  targetId: number
  direction: Direction
  feedback: Feedback | null
  onSelect: (option: Word) => void
}

export function Options({ options, targetId, direction, feedback, onSelect }: Props) {
  return (
    <section className="options">
      {options.map((o) => {
        let cls = 'option'
        if (feedback) {
          if (o.id === targetId) cls += ' option-correct'
          else if (o.id === feedback.chosenId) cls += ' option-wrong'
          else cls += ' option-dim'
        }
        return (
          <button key={o.id} className={cls} disabled={feedback !== null} onClick={() => onSelect(o)}>
            {labelOf(o, direction)}
          </button>
        )
      })}
    </section>
  )
}
