import type { Progress } from './state'

/** Состояние раздела «Речь»: тот же прогресс по словам, что и в «Словах», но без настроек направления. */
export type SpeakState = Progress

export function initialSpeakState(): SpeakState {
  return { learned: [], weak: {}, score: 0, bestStreak: 0, lastId: null }
}

/** Пропуск слова: без штрафа, только запоминаем, чтобы не выпало сразу снова. */
export function skipWord(state: SpeakState, wordId: number): SpeakState {
  return { ...state, lastId: wordId }
}

export function restartSpeak(_state: SpeakState): SpeakState {
  return initialSpeakState()
}
