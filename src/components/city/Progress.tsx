import { useEffect, useState } from 'react'

interface Props {
  label: string
  startedAt: number
  expectedMs: number
}

export function Progress({ label, startedAt, expectedMs }: Props) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [])
  const elapsed = Math.max(0, now - startedAt)
  const ratio = elapsed / Math.max(1, expectedMs)
  const pct = ratio < 1 ? Math.round(ratio * 95) : Math.min(99, Math.round(95 + (1 - 1 / (ratio * 2)) * 4))
  const left = Math.ceil((expectedMs - elapsed) / 1000)
  return (
    <div className="progress-card" role="status">
      <div className="progress-label">
        <span>{label}</span>
        <span className="progress-pct">{pct}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="progress-eta">{left > 0 ? `осталось ≈ ${left} с` : 'почти готово…'}</div>
    </div>
  )
}
