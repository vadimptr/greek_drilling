import { lessonsUpTo } from '../data/grammar'
import { wordPool } from '../data/levels'
import { CITY_AMBIENCE_LEVELS, CITY_SPEEDS, type SpeakHint } from '../logic/appState'
import { CITY_NAMES, LANG_NAMES, LANGS, type Lang } from '../logic/city/name'
import { useT } from '../logic/i18n'
import { LEVELS, type Direction, type Level } from '../types/word'

interface Props {
  open: boolean
  learnLang: Lang
  hintLang: Lang
  onLearnLang: (l: Lang) => void
  onHintLang: (l: Lang) => void
  direction: Direction
  autoSpeak: boolean
  level: Level
  canSpeak: boolean
  speakHint: SpeakHint
  citySpeed: number
  onCitySpeed: (v: number) => void
  cityAmbience: number
  onCityAmbience: (v: number) => void
  onDirection: (d: Direction) => void
  onAutoSpeak: (v: boolean) => void
  onLevel: (l: Level) => void
  onSpeakHint: (h: SpeakHint) => void
  onReset: () => void
  onClose: () => void
}

export function SettingsSheet({
  open,
  learnLang,
  hintLang,
  onLearnLang,
  onHintLang,
  direction,
  autoSpeak,
  level,
  canSpeak,
  speakHint,
  citySpeed,
  onCitySpeed,
  cityAmbience,
  onCityAmbience,
  onDirection,
  onAutoSpeak,
  onLevel,
  onSpeakHint,
  onReset,
  onClose,
}: Props) {
  const t = useT()
  if (!open) return null
  const greek = learnLang === 'el'
  const city = CITY_NAMES[learnLang]
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2 className="sheet-title">{t('settings.title')}</h2>

        <div className="sheet-label">{t('settings.learn')}</div>
        <div className="segmented seg-3">
          {LANGS.map((l) => (
            <button key={l} className={l === learnLang ? 'seg seg-active' : 'seg'} onClick={() => onLearnLang(l)}>
              {LANG_NAMES[l]}
            </button>
          ))}
        </div>

        <div className="sheet-label">{t('settings.hint')}</div>
        <div className="segmented seg-3">
          {LANGS.map((l) => (
            <button
              key={l}
              className={l === hintLang ? 'seg seg-active' : l === learnLang ? 'seg seg-off' : 'seg'}
              disabled={l === learnLang}
              onClick={() => onHintLang(l)}
            >
              {LANG_NAMES[l]}
            </button>
          ))}
        </div>

        {greek && (
          <>
            <div className="sheet-label">Слова: направление</div>
            <div className="segmented">
              <button className={direction === 'el-ru' ? 'seg seg-active' : 'seg'} onClick={() => onDirection('el-ru')}>
                Ελληνικά → Русский
              </button>
              <button className={direction === 'ru-el' ? 'seg seg-active' : 'seg'} onClick={() => onDirection('ru-el')}>
                Русский → Ελληνικά
              </button>
            </div>
          </>
        )}

        <div className="sheet-label">
          {greek
            ? `Уровень ${level}: ${wordPool(level).length} слов, ${lessonsUpTo(level).length} уроков грамматики`
            : t('settings.level', { level })}
        </div>
        <div className="level-slider">
          <input
            type="range"
            min={0}
            max={LEVELS.length - 1}
            step={1}
            value={LEVELS.indexOf(level)}
            onChange={(e) => onLevel(LEVELS[Number(e.target.value)])}
            aria-label={t('header.level')}
          />
          <div className="level-ticks">
            {LEVELS.map((l) => (
              <button key={l} className={l === level ? 'level-tick level-tick-active' : 'level-tick'} onClick={() => onLevel(l)}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {greek && (
          <>
            <div className="sheet-label">Речь: что показывать</div>
            <div className="segmented">
              <button className={speakHint === 'el' ? 'seg seg-active' : 'seg'} onClick={() => onSpeakHint('el')}>
                Слово и перевод
              </button>
              <button className={speakHint === 'ru' ? 'seg seg-active' : 'seg'} onClick={() => onSpeakHint('ru')}>
                Только перевод
              </button>
            </div>
          </>
        )}

        <div className="sheet-label">{t('settings.speed', { city, speed: citySpeed.toFixed(1) })}</div>
        <div className="level-slider">
          <input
            type="range"
            min={0}
            max={CITY_SPEEDS.length - 1}
            step={1}
            value={Math.max(0, CITY_SPEEDS.indexOf(citySpeed))}
            onChange={(e) => onCitySpeed(CITY_SPEEDS[Number(e.target.value)])}
            aria-label={t('settings.speedAria')}
          />
          <div className="level-ticks">
            {CITY_SPEEDS.map((v) => (
              <button key={v} className={v === citySpeed ? 'level-tick level-tick-active' : 'level-tick'} onClick={() => onCitySpeed(v)}>
                {v.toFixed(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="sheet-label">
          {t('settings.ambience', { city, value: cityAmbience === 0 ? t('settings.off') : `${Math.round(cityAmbience * 100)}%` })}
        </div>
        <div className="level-slider">
          <input
            type="range"
            min={0}
            max={CITY_AMBIENCE_LEVELS.length - 1}
            step={1}
            value={Math.max(0, CITY_AMBIENCE_LEVELS.indexOf(cityAmbience))}
            onChange={(e) => onCityAmbience(CITY_AMBIENCE_LEVELS[Number(e.target.value)])}
            aria-label={t('settings.ambienceAria')}
          />
          <div className="level-ticks">
            {CITY_AMBIENCE_LEVELS.map((v) => (
              <button
                key={v}
                className={v === cityAmbience ? 'level-tick level-tick-active' : 'level-tick'}
                onClick={() => onCityAmbience(v)}
              >
                {v === 0 ? t('settings.offShort') : Math.round(v * 100)}
              </button>
            ))}
          </div>
        </div>

        {greek && (
          <label className="toggle-row">
            <span>
              Озвучивать слово автоматически
              {!canSpeak && <span className="sheet-label"> (браузер не поддерживает озвучку)</span>}
            </span>
            <input type="checkbox" checked={autoSpeak} disabled={!canSpeak} onChange={(e) => onAutoSpeak(e.target.checked)} />
          </label>
        )}

        <button
          className="danger-btn"
          onClick={() => {
            if (window.confirm(t('settings.resetConfirm'))) onReset()
          }}
        >
          {t('settings.reset')}
        </button>

        <button className="secondary-btn" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </div>
  )
}
