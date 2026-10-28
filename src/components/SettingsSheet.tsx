import { lessonsUpTo } from '../data/grammar'
import { wordPool } from '../data/levels'
import { CITY_SPEEDS, type SpeakHint } from '../logic/appState'
import { CITY_NAME } from '../logic/city/name'
import { LEVELS, type Direction, type Level } from '../types/word'

interface Props {
  open: boolean
  direction: Direction
  autoSpeak: boolean
  level: Level
  canSpeak: boolean
  speakHint: SpeakHint
  citySpeed: number
  onCitySpeed: (v: number) => void
  onDirection: (d: Direction) => void
  onAutoSpeak: (v: boolean) => void
  onLevel: (l: Level) => void
  onSpeakHint: (h: SpeakHint) => void
  onReset: () => void
  onClose: () => void
}

export function SettingsSheet({
  open,
  direction,
  autoSpeak,
  level,
  canSpeak,
  speakHint,
  citySpeed,
  onCitySpeed,
  onDirection,
  onAutoSpeak,
  onLevel,
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

        <div className="sheet-label">
          Уровень {level}: {wordPool(level).length} слов, {lessonsUpTo(level).length} уроков грамматики
        </div>
        <div className="level-slider">
          <input
            type="range"
            min={0}
            max={LEVELS.length - 1}
            step={1}
            value={LEVELS.indexOf(level)}
            onChange={(e) => onLevel(LEVELS[Number(e.target.value)])}
            aria-label="Уровень"
          />
          <div className="level-ticks">
            {LEVELS.map((l) => (
              <button key={l} className={l === level ? 'level-tick level-tick-active' : 'level-tick'} onClick={() => onLevel(l)}>
                {l}
              </button>
            ))}
          </div>
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

        <div className="sheet-label">{CITY_NAME}: скорость речи жителей — {citySpeed.toFixed(1)}×</div>
        <div className="level-slider">
          <input
            type="range"
            min={0}
            max={CITY_SPEEDS.length - 1}
            step={1}
            value={Math.max(0, CITY_SPEEDS.indexOf(citySpeed))}
            onChange={(e) => onCitySpeed(CITY_SPEEDS[Number(e.target.value)])}
            aria-label="Скорость речи жителей"
          />
          <div className="level-ticks">
            {CITY_SPEEDS.map((v) => (
              <button key={v} className={v === citySpeed ? 'level-tick level-tick-active' : 'level-tick'} onClick={() => onCitySpeed(v)}>
                {v.toFixed(1)}
              </button>
            ))}
          </div>
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
