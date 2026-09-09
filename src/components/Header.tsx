interface Props {
  score: number
  bestStreak: number
  learnedCount: number
  weakCount: number
  total: number
  onSettings: () => void
}

export function Header({ score, bestStreak, learnedCount, weakCount, total, onSettings }: Props) {
  const pct = total === 0 ? 0 : Math.round((learnedCount / total) * 100)
  return (
    <header className="header">
      <div className="header-row">
        <div className="stat" aria-label="Очки">
          <span className="stat-icon">⚡</span>
          <span key={score} className="stat-value score-bump">
            {score}
          </span>
        </div>
        <div className="stat" aria-label="Лучший стрик">
          <span className="stat-icon">🏆</span>
          <span className="stat-value">{bestStreak}</span>
        </div>
        <button className="icon-btn" onClick={onSettings} aria-label="Настройки">
          ⚙︎
        </button>
      </div>
      <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="progress-label">
        Выучено {learnedCount} / {total} · слабых {weakCount}
      </div>
    </header>
  )
}
