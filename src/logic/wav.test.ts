import { describe, expect, it } from 'vitest'
import { downsample, encodeWav, rms, TARGET_RATE } from './wav'

describe('rms', () => {
  it('measures signal level', () => {
    expect(rms(new Float32Array([0, 0, 0]))).toBe(0)
    expect(rms(new Float32Array([0.5, -0.5, 0.5, -0.5]))).toBeCloseTo(0.5)
    expect(rms(new Float32Array(0))).toBe(0)
  })
})

describe('downsample', () => {
  it('returns input untouched when rates match', () => {
    const s = new Float32Array([0.1, 0.2, 0.3])
    expect(downsample(s, 16000, 16000)).toBe(s)
  })

  it('reduces length proportionally and averages samples', () => {
    const s = new Float32Array([0, 1, 0, 1, 0, 1, 0, 1])
    const out = downsample(s, 32000, 16000)
    expect(out.length).toBe(4)
    for (const v of out) expect(v).toBeCloseTo(0.5)
  })

  it('handles non-integer ratios', () => {
    const s = new Float32Array(48000).fill(0.25)
    const out = downsample(s, 48000, 16000)
    expect(out.length).toBe(16000)
    expect(out[0]).toBeCloseTo(0.25)
    expect(out[15999]).toBeCloseTo(0.25)
  })
})

describe('encodeWav', () => {
  it('writes a 44-byte PCM16 mono header and clamped samples', () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1, 2, -2])
    const buf = encodeWav(samples, TARGET_RATE)
    expect(buf.byteLength).toBe(44 + samples.length * 2)
    const view = new DataView(buf)
    const ascii = (o: number, n: number) => String.fromCharCode(...new Uint8Array(buf, o, n))
    expect(ascii(0, 4)).toBe('RIFF')
    expect(ascii(8, 4)).toBe('WAVE')
    expect(ascii(12, 4)).toBe('fmt ')
    expect(view.getUint32(4, true)).toBe(36 + samples.length * 2)
    expect(view.getUint16(20, true)).toBe(1) // PCM
    expect(view.getUint16(22, true)).toBe(1) // mono
    expect(view.getUint32(24, true)).toBe(16000)
    expect(view.getUint32(28, true)).toBe(32000) // byte rate
    expect(view.getUint16(32, true)).toBe(2) // block align
    expect(view.getUint16(34, true)).toBe(16) // bits
    expect(ascii(36, 4)).toBe('data')
    expect(view.getUint32(40, true)).toBe(samples.length * 2)
    expect(view.getInt16(44, true)).toBe(0)
    expect(view.getInt16(46, true)).toBe(16383)
    expect(view.getInt16(48, true)).toBe(-16384)
    expect(view.getInt16(50, true)).toBe(32767)
    expect(view.getInt16(52, true)).toBe(-32768)
    expect(view.getInt16(54, true)).toBe(32767)
    expect(view.getInt16(56, true)).toBe(-32768)
  })
})
