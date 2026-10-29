import { useT } from '../logic/i18n'

export interface Stat {
  icon: string
  value: string | number
  label: string
  /** Перерисовать с анимацией при смене значения */
  bump?: boolean
}

interface Props {
  left: Stat
  right: Stat
  subtitle: string
  /** 0..1 или null, если полоса не нужна */
  progress: number | null
  onSettings: () => void
  user: string | null
  onAccount: () => void
}

export function Header({ left, right, subtitle, progress, onSettings, user, onAccount }: Props) {
  const t = useT()
  const pct = progress === null ? 0 : Math.round(Math.min(1, Math.max(0, progress)) * 100)
  return (
    <header className="header">
      <div className="header-row">
        <div className="stat" aria-label={left.label}>
          <span className="stat-icon">{left.icon}</span>
          <span key={left.bump ? String(left.value) : 'l'} className={left.bump ? 'stat-value score-bump' : 'stat-value'}>
            {left.value}
          </span>
        </div>
        <div className="stat" aria-label={right.label}>
          <span className="stat-icon">{right.icon}</span>
          <span className="stat-value">{right.value}</span>
        </div>
        {user !== null ? (
          <button className="icon-btn user-btn" onClick={onAccount} aria-label={`${t('header.account')}: ${user}`}>
            <span className="user-btn-icon">👤</span>
            <span className="user-btn-name">{user}</span>
          </button>
        ) : (
          <button className="icon-btn login-btn" onClick={onAccount}>
            {t('header.signIn')}
          </button>
        )}
        <button className="icon-btn" onClick={onSettings} aria-label={t('header.settings')}>
          ⚙︎
        </button>
      </div>
      {progress !== null && (
        <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className="progress-label">{subtitle}</div>
    </header>
  )
}
