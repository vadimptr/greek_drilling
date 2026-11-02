import { describe, expect, it } from 'vitest'
import { CELEBRATE_EVERY, MISS_AFTER_MS, missed, reaction } from './drilly'

describe('drilly', () => {
  it('is happy on a right answer and thoughtful on a mistake', () => {
    expect(reaction(0, { correct: true, counts: true })).toEqual({ emotion: 'happy', done: 1, milestone: false })
    expect(reaction(3, { correct: false, counts: true })).toEqual({ emotion: 'thinking', done: 4, milestone: false })
  })

  it('celebrates every ten finished exercises, steps inside one exercise do not count', () => {
    expect(reaction(CELEBRATE_EVERY - 1, { correct: false, counts: true })).toEqual({ emotion: 'celebrate', done: CELEBRATE_EVERY, milestone: true })
    expect(reaction(CELEBRATE_EVERY - 1, { correct: true, counts: false })).toEqual({ emotion: 'happy', done: CELEBRATE_EVERY - 1, milestone: false })
  })

  it('misses the learner after two days away, not on the first visit', () => {
    const now = Date.now()
    expect(missed(null, now)).toBe(false)
    expect(missed(now - MISS_AFTER_MS + 1000, now)).toBe(false)
    expect(missed(now - MISS_AFTER_MS - 1000, now)).toBe(true)
  })
})
