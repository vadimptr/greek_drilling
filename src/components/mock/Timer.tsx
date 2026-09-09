import { useEffect, useRef, useState } from 'react'

interface Props {
  /** Момент окончания, ms since epoch */
  endsAt: number
  onExpire: () => void
}

function format(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function Timer({ endsAt, onExpire }: Props) {
  const [left, setLeft] = useState(endsAt - Date.now())
  const fired = useRef(false)

  useEffect(() => {
    fired.current = false
    const tick = () => {
      const rest = endsAt - Date.now()
      setLeft(rest)
      if (rest <= 0 && !fired.current) {
        fired.current = true
        onExpire()
      }
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [endsAt, onExpire])

  const urgent = left < 5 * 60 * 1000
  return (
    <span className={urgent ? 'timer timer-urgent' : 'timer'} aria-label="Оставшееся время">
      ⏱ {format(left)}
    </span>
  )
}
