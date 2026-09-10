import type { SpeakHint } from '../logic/appState'
import type { Direction } from '../types/word'

interface Props {
  open: boolean
  direction: Direction
  autoSpeak: boolean
  canSpeak: boolean
  speakHint: SpeakHint
  onDirection: (d: Direction) => void
  onAutoSpeak: (v: boolean) => void
  onSpeakHint: (h: SpeakHint) => void
  onReset: () => void
  onClose: () => void
}

export function SettingsSheet({
  open,
  direction,
  autoSpeak,
  canSpeak,
  speakHint,
  onDirection,
  onAutoSpeak,
  onSpeakHint,
  onReset,
  onClose,
}: Props) {
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2 className="sheet-title">Настройки</h2>

        <div className="sheet-label">Слова: направление</div>
        <div className="segmented">
          <button
            className={direction === 'el-ru' ? 'seg seg-active' : 'seg'}
            onClick={() => onDirection('el-ru')}
          >
            Ελληνικά → Русский
          </button>
          <button
            className={direction === 'ru-el' ? 'seg seg-active' : 'seg'}
            onClick={() => onDirection('ru-el')}
          >
            Русский → Ελληνικά
          </button>
        </div>

        <div className="sheet-label">Речь: что показывать</div>
        <div className="segmented">
          <button className={speakHint === 'el' ? 'seg seg-active' : 'seg'} onClick={() => onSpeakHint('el')}>
            Слово и перевод
          </button>
          <button className={speakHint === 'ru' ? 'seg seg-active' : 'seg'} onClick={() => onSpeakHint('ru')}>
            Только перевод
          </button>
        </div>

        <label className="toggle-row">
          <span>
            Озвучивать слово автоматически
            {!canSpeak && <span className="sheet-label"> (браузер не поддерживает озвучку)</span>}
          </span>
          <input
            type="checkbox"
            checked={autoSpeak}
            disabled={!canSpeak}
            onChange={(e) => onAutoSpeak(e.target.checked)}
          />
        </label>

        <button
          className="danger-btn"
          onClick={() => {
            if (window.confirm('Сбросить весь прогресс?')) onReset()
          }}
        >
          Сбросить прогресс
        </button>

        <button className="secondary-btn" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  )
}
