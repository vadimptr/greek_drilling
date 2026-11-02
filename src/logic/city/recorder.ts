const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

export interface Recording {
  blob: Blob
  ms: number
}

export class Recorder {
  private stream: MediaStream | null = null
  private rec: MediaRecorder | null = null
  private chunks: Blob[] = []
  private startedAt = 0

  async start(): Promise<void> {
    if (!this.stream || this.stream.getAudioTracks().every((t) => t.readyState === 'ended')) {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    }
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
    if (!rec || rec.state === 'inactive') return Promise.resolve({ blob: new Blob(), ms: 0 })
    const ms = performance.now() - this.startedAt
    return new Promise((resolve) => {
      rec.onstop = () => resolve({ blob: new Blob(this.chunks, { type: (rec.mimeType || 'audio/webm').split(';')[0] }), ms })
      rec.stop()
    })
  }

  close(): void {
    if (this.rec && this.rec.state !== 'inactive') this.rec.stop()
    this.rec = null
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
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
