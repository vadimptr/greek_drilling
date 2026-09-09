import { describe, expect, it } from 'vitest'
import { pickGreekVoice } from './speech'

const voice = (name: string, lang: string, localService = true, def = false) =>
  ({ name, lang, localService, default: def, voiceURI: name }) as SpeechSynthesisVoice

describe('pickGreekVoice', () => {
  it('returns null when there is no greek voice', () => {
    expect(pickGreekVoice([voice('Samantha', 'en-US'), voice('Milena', 'ru-RU')])).toBeNull()
    expect(pickGreekVoice([])).toBeNull()
  })

  it('finds greek voice by lang, including underscore format', () => {
    expect(pickGreekVoice([voice('Samantha', 'en-US'), voice('Melina', 'el-GR')])?.name).toBe('Melina')
    expect(pickGreekVoice([voice('Greek', 'el_GR')])?.name).toBe('Greek')
  })

  it('prefers local voices over remote ones', () => {
    const remote = voice('Google Greek', 'el-GR', false)
    const local = voice('Melina', 'el-GR', true)
    expect(pickGreekVoice([remote, local])?.name).toBe('Melina')
  })
})
