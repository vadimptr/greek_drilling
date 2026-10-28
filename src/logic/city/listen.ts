const CALIBRATE_MS = 400
const HOLD_MS = 150

export async function listenForVoice(onVoice: () => void): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
  const ctx = new AudioContext()
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 1024
  ctx.createMediaStreamSource(stream).connect(analyser)
  const buf = new Float32Array(analyser.fftSize)
  const started = performance.now()
  let noise = 0
  let samples = 0
  let loudSince = 0
  let stopped = false
  let frame = 0

  const level = () => {
    analyser.getFloatTimeDomainData(buf)
    let sum = 0
    for (const v of buf) sum += v * v
    return Math.sqrt(sum / buf.length)
  }

  const stop = () => {
    if (stopped) return
    stopped = true
    cancelAnimationFrame(frame)
    stream.getTracks().forEach((t) => t.stop())
    void ctx.close()
  }

  const tick = () => {
    if (stopped) return
    const now = performance.now()
    const rms = level()
    if (now - started < CALIBRATE_MS) {
      noise = (noise * samples + rms) / ++samples
    } else if (rms > Math.max(0.015, noise * 3.5)) {
      loudSince ||= now
      if (now - loudSince >= HOLD_MS) {
        stop()
        onVoice()
        return
      }
    } else {
      loudSince = 0
    }
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  return stop
}
