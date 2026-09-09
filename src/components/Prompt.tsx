import type { Direction, Word } from '../types/word'
import { promptOf } from '../logic/options'
import { transliterate } from '../logic/translit'

interface Props {
  word: Word
  direction: Direction
  canSpeak: boolean
  onTapWord: () => void
  onSpeak: () => void
}

export function Prompt({ word, direction, canSpeak, onTapWord, onSpeak }: Props) {
  const greekShown = direction === 'el-ru'
  return (
    <main className="prompt">
      <div className="prompt-row">
        <button key={word.id} className="prompt-word" onClick={onTapWord} aria-label="Показать сведения о слове">
          {promptOf(word, direction)}
        </button>
        {greekShown && canSpeak && (
          <button className="speak-btn" onClick={onSpeak} aria-label="Озвучить">
            🔊
          </button>
        )}
      </div>
      {greekShown && <div className="prompt-translit">{transliterate(word.el)}</div>}
    </main>
  )
}
