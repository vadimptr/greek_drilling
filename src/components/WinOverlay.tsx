import { useMemo } from 'react'

interface Props {
  total: number
  bestStreak: number
  onRestart: () => void
}

const COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899']

export function WinOverlay({ total, bestStreak, onRestart }: Props) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 12) * 0.15}s`,
        duration: `${2.2 + (i % 5) * 0.3}s`,
        color: COLORS[i % COLORS.length],
        rotate: `${(i * 53) % 360}deg`,
      })),
    [],
  )
  return (
    <div className="win">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti"
          style={{
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.duration,
            background: p.color,
            transform: `rotate(${p.rotate})`,
          }}
        />
      ))}
      <div className="win-card">
        <div className="win-emoji">🎉</div>
        <h1 className="win-title">Все {total} слов!</h1>
        <p className="win-sub">Лучший стрик: {bestStreak}</p>
        <button className="primary-btn" onClick={onRestart}>
          Начать снова
        </button>
      </div>
    </div>
  )
}
