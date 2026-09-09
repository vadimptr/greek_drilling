/** Озвучка греческого текста через Web Speech API. Молча ничего не делает, если API нет. */

let cachedVoice: SpeechSynthesisVoice | null | undefined

function pickGreekVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice !== undefined) return cachedVoice
  const voices = window.speechSynthesis.getVoices()
  const greek = voices.filter((v) => v.lang.toLowerCase().startsWith('el'))
  // предпочитаем локальный голос (на iOS это «Melina»)
  cachedVoice = greek.find((v) => v.localService) ?? greek[0] ?? null
  if (voices.length === 0) cachedVoice = undefined // список ещё не загружен, попробуем в следующий раз
  return cachedVoice ?? null
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

export function speak(text: string): void {
  if (!canSpeak()) return
  try {
    const synth = window.speechSynthesis
    synth.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'el-GR'
    utter.rate = 0.9
    const voice = pickGreekVoice()
    if (voice) utter.voice = voice
    synth.speak(utter)
  } catch {
    // озвучка необязательна
  }
}

/** Прогреть список голосов (на некоторых браузерах он приходит асинхронно). */
export function warmUpVoices(): void {
  if (!canSpeak()) return
  try {
    window.speechSynthesis.getVoices()
    window.speechSynthesis.addEventListener?.('voiceschanged', () => {
      cachedVoice = undefined
    })
  } catch {
    // ignore
  }
}
