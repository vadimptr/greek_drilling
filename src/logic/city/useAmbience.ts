import { useEffect, useRef } from 'react'

const FADE_MS = 1500
const DUCK = 0.35

interface Track {
  audio: HTMLAudioElement
  url: string
}

export function useAmbience(url: string | null, volume: number, ducked: boolean) {
  const current = useRef<Track | null>(null)
  const fading = useRef<Track[]>([])
  const target = volume * (ducked ? DUCK : 1)
  const targetRef = useRef(target)
  targetRef.current = target

  useEffect(() => {
    const timer = window.setInterval(() => {
      const step = 50 / FADE_MS
      const cur = current.current
      if (cur) {
        const goal = targetRef.current
        const v = cur.audio.volume
        cur.audio.volume = Math.abs(goal - v) <= step ? goal : v + Math.sign(goal - v) * step
      }
      fading.current = fading.current.filter((t) => {
        t.audio.volume = Math.max(0, t.audio.volume - step)
        if (t.audio.volume > 0) return true
        t.audio.pause()
        return false
      })
    }, 50)
    return () => {
      window.clearInterval(timer)
      for (const t of [current.current, ...fading.current]) t?.audio.pause()
      current.current = null
      fading.current = []
    }
  }, [])

  useEffect(() => {
    const want = volume > 0 ? url : null
    if (current.current?.url === want) return
    if (current.current) fading.current.push(current.current)
    current.current = null
    if (!want) return
    const audio = new Audio(want)
    audio.loop = true
    audio.volume = 0
    current.current = { audio, url: want }
    void audio.play().catch(() => undefined)
  }, [url, volume])
}
