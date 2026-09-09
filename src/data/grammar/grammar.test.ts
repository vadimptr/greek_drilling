import { describe, expect, it } from 'vitest'
import { LESSONS } from './index'

describe('LESSONS', () => {
  it('has at least 30 lessons with consecutive ids and unique titles', () => {
    expect(LESSONS.length).toBeGreaterThanOrEqual(30)
    LESSONS.forEach((l, i) => expect(l.id, `lesson ${l.title}`).toBe(i + 1))
    expect(new Set(LESSONS.map((l) => l.title)).size).toBe(LESSONS.length)
  })

  it('every lesson has explanation sections and 10–14 questions', () => {
    for (const l of LESSONS) {
      expect(l.sections.length, `lesson ${l.id} sections`).toBeGreaterThan(0)
      expect(l.summary.trim().length, `lesson ${l.id} summary`).toBeGreaterThan(0)
      expect(l.questions.length, `lesson ${l.id} questions`).toBeGreaterThanOrEqual(10)
      expect(l.questions.length, `lesson ${l.id} questions`).toBeLessThanOrEqual(14)
    }
  })

  it('question ids are `${lessonId}-${n}` and consecutive', () => {
    for (const l of LESSONS) {
      l.questions.forEach((q, i) => expect(q.id, `lesson ${l.id}`).toBe(`${l.id}-${i + 1}`))
    }
  })

  it('options are 3–4, unique, answer index valid, explanation present, at most one gap', () => {
    for (const l of LESSONS) {
      for (const q of l.questions) {
        expect(q.options.length, q.id).toBeGreaterThanOrEqual(3)
        expect(q.options.length, q.id).toBeLessThanOrEqual(4)
        expect(new Set(q.options.map((o) => o.trim().toLowerCase())).size, `${q.id} duplicate options`).toBe(
          q.options.length,
        )
        expect(q.answer, q.id).toBeGreaterThanOrEqual(0)
        expect(q.answer, q.id).toBeLessThan(q.options.length)
        expect(q.explain?.trim().length ?? 0, `${q.id} explain`).toBeGreaterThan(0)
        // два пропуска допустимы для парных конструкций («από … μέχρι»)
        const gaps = (q.prompt.match(/___/g) ?? []).length
        expect(gaps, `${q.id} gaps`).toBeLessThanOrEqual(2)
        if (gaps === 2) for (const o of q.options) expect(o.includes('…'), `${q.id} paired option`).toBe(true)
        for (const o of q.options) expect(o.trim().length, `${q.id} empty option`).toBeGreaterThan(0)
      }
    }
  })

  it('tables have consistent column counts', () => {
    for (const l of LESSONS) {
      for (const s of l.sections) {
        if (s.type !== 'table') continue
        for (const row of s.rows) expect(row.length, `lesson ${l.id} table row`).toBe(s.header.length)
      }
    }
  })
})
