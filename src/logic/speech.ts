/** Озвучка греческого текста через Web Speech API. Молча ничего не делает, если API нет. */

// iOS может «забыть» utterance, если на него нет ссылки, — держим последний.
let current: SpeechSynthesisUtterance | null = null

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

/**
 * Выбирает греческий голос. Список голосов на iOS/Android приходит асинхронно и может меняться,
 * поэтому ничего не кэшируем и ищем при каждом вызове.
 */
export function pickGreekVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const greek = voices.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('el'))
  if (greek.length === 0) return null
  return (
    greek.find((v) => v.localService && v.default) ??
    greek.find((v) => v.localService) ??
    greek.find((v) => v.default) ??
    greek[0]
  )
}

export function speak(text: string): void {
  if (!canSpeak()) return
  try {
    const synth = window.speechSynthesis
    synth.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'el-GR'
    utter.rate = 0.9
    const voice = pickGreekVoice(synth.getVoices())
    if (voice) utter.voice = voice
    utter.onend = () => {
      if (current === utter) current = null
    }
    current = utter
    synth.speak(utter)
  } catch {
    // озвучка необязательна
  }
}

/** Попросить браузер загрузить список голосов заранее (на iOS он пустой до первого обращения). */
export function warmUpVoices(): void {
  if (!canSpeak()) return
  try {
    window.speechSynthesis.getVoices()
  } catch {
    // ignore
  }
}
