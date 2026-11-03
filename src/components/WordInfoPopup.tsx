import type { Word } from '../types/word'
import { describeWord } from '../logic/describe'
import { transliterate } from '../logic/translit'
import { canSpeak, speak } from '../logic/speech'

interface Props {
  word: Word | null
  onClose: () => void
}

/** Карточка со сведениями о слове. Закрывается тапом в любое место. */
export function WordInfoPopup({ word, onClose }: Props) {
  if (!word) return null
  const info = describeWord(word)
  return (
    <div className="info-backdrop" onClick={onClose}>
      <div className="info-card" role="dialog" aria-label="Сведения о слове">
        <div className="info-word-row">
          <span className="info-word">{word.el}</span>
          {canSpeak() && (
            <button
              className="speak-btn"
              onClick={(e) => {
                e.stopPropagation()
                speak(word.el)
              }}
              aria-label="Послушать"
            >
              🔊
            </button>
          )}
        </div>
        <div className="info-translit">{transliterate(word.el)}</div>
        <div className="info-title">{info.title}</div>
        {info.lines.map((line, i) => (
          <p key={i} className="info-line">
            {line}
          </p>
        ))}
        <div className="info-hint">Нажми в любом месте, чтобы закрыть</div>
      </div>
    </div>
  )
}
