const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

export interface Recording {
  blob: Blob
  ms: number
  peak: number | null
}

export class Recorder {
  private stream: MediaStream | null = null
  private rec: MediaRecorder | null = null
  private chunks: Blob[] = []
  private startedAt = 0
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private samples: Float32Array<ArrayBuffer> | null = null
  private peak = 0

  prepare(): void {
    try {
      this.ctx ??= new AudioContext()
      void this.ctx.resume().catch(() => undefined)
    } catch {
      this.ctx = null
    }
  }

  level(): number {
    if (!this.analyser || !this.samples || this.ctx?.state !== 'running') return 0
    this.analyser.getFloatTimeDomainData(this.samples)
    let sum = 0
    for (const v of this.samples) sum += v * v
    const rms = Math.sqrt(sum / this.samples.length)
    this.peak = Math.max(this.peak, rms)
    return rms
  }

  async start(): Promise<void> {
    if (!this.stream || this.stream.getAudioTracks().every((t) => t.readyState === 'ended')) {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      this.analyser = null
    }
    if (this.ctx && !this.analyser) {
      this.analyser = this.ctx.createAnalyser()
      this.analyser.fftSize = 1024
      this.samples = new Float32Array(this.analyser.fftSize)
      this.ctx.createMediaStreamSource(this.stream).connect(this.analyser)
    }
    this.peak = 0
    const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t))
    const rec = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined)
    this.chunks = []
    rec.ondataavailable = (e) => {
      if (e.data.size) this.chunks.push(e.data)
    }
    await new Promise<void>((resolve, reject) => {
      rec.onstart = () => resolve()
      rec.onerror = () => reject(new Error('recorder failed'))
      rec.start()
    })
    this.rec = rec
    this.startedAt = performance.now()
  }

  stop(): Promise<Recording> {
    const rec = this.rec
    this.rec = null
    if (!rec || rec.state === 'inactive') return Promise.resolve({ blob: new Blob(), ms: 0, peak: null })
    const ms = performance.now() - this.startedAt
    this.level()
    const peak = this.ctx?.state === 'running' && this.analyser ? this.peak : null
    return new Promise((resolve) => {
      rec.onstop = () => resolve({ blob: new Blob(this.chunks, { type: (rec.mimeType || 'audio/webm').split(';')[0] }), ms, peak })
      rec.stop()
    })
  }

  close(): void {
    if (this.rec && this.rec.state !== 'inactive') this.rec.stop()
    this.rec = null
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.analyser = null
  }
}

const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='

export class Player {
  private el = new Audio()
  private finish: (() => void) | null = null
  private unlocked = false

  unlock(): void {
    if (this.unlocked || this.finish) return
    this.unlocked = true
    this.el.src = SILENCE
    void this.el.play().catch(() => undefined)
  }

  play(base64: string): Promise<void> {
    this.stop()
    return new Promise((resolve) => {
      const done = () => {
        this.el.onended = null
        this.el.onerror = null
        this.finish = null
        resolve()
      }
      this.finish = done
      this.el.onended = done
      this.el.onerror = done
      this.el.src = `data:audio/mpeg;base64,${base64}`
      this.el.play().catch(done)
    })
  }

  stop(): void {
    this.el.pause()
    this.finish?.()
  }
}
