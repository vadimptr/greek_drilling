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
    <div className="pc" role="status">
      <div className="pc-label">
        <span>{label}</span>
        <span className="pc-pct">{pct}%</span>
      </div>
      <div className="pc-track">
        <div className="pc-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="pc-eta">{left > 0 ? `осталось ≈ ${left} с` : 'почти готово…'}</div>
    </div>
  )
}
