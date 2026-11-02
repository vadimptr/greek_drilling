import { useEffect, useRef, useState } from 'react'
import { DRILLY_EMOTIONS, drillyImage, missed, onDrilly, reaction, type DrillyEmotion, type DrillyOutfit } from '../logic/drilly'
import { useT } from '../logic/i18n'

const LAST_KEY = 'greek_drilling.lastActive'
const HOLD_MS: Record<DrillyEmotion, number> = { idle: 0, happy: 1600, thinking: 2200, celebrate: 3600, miss: 0 }

function readLast(): number | null {
  try {
    const v = Number(localStorage.getItem(LAST_KEY))
    return Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

function writeLast(at: number): void {
  try {
    localStorage.setItem(LAST_KEY, String(at))
  } catch {
    return
  }
}

export function Drilly({ outfit = 'base' }: { outfit?: DrillyOutfit }) {
  const t = useT()
  const [emotion, setEmotion] = useState<DrillyEmotion>(() => (missed(readLast(), Date.now()) ? 'miss' : 'idle'))
  const [bubble, setBubble] = useState<string | null>(() => (missed(readLast(), Date.now()) ? t('drilly.missed') : null))
  const [beat, setBeat] = useState(0)
  const done = useRef(0)
  const timer = useRef<number | undefined>(undefined)
  const tRef = useRef(t)
  tRef.current = t

  useEffect(() => {
    if (!missed(readLast(), Date.now())) writeLast(Date.now())
    return onDrilly((signal) => {
      const r = reaction(done.current, signal)
      done.current = r.done
      writeLast(Date.now())
      setEmotion(r.emotion)
      setBeat((b) => b + 1)
      setBubble(r.milestone ? tRef.current('drilly.milestone', { n: r.done }) : null)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        setEmotion('idle')
        setBubble(null)
      }, HOLD_MS[r.emotion])
    })
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <div className="drilly" aria-hidden="true">
      <div key={beat} className={`drilly-figure drilly-${emotion}`}>
        {DRILLY_EMOTIONS.map((e) => (
          <img
            key={e}
            className={e === emotion ? 'drilly-img drilly-img-on' : 'drilly-img'}
            src={drillyImage(outfit, e)}
            alt=""
            draggable={false}
          />
        ))}
        {emotion === 'celebrate' && (
          <span className="drilly-confetti">
            {Array.from({ length: 10 }, (_, i) => (
              <i key={i} style={{ ['--i' as string]: i }} />
            ))}
          </span>
        )}
      </div>
      {bubble && <div className="drilly-bubble">{bubble}</div>}
    </div>
  )
}
