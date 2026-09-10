import { afterEach, describe, expect, it, vi } from 'vitest'
import { transcribe, TranscribeError } from './transcribe'

const wav = new ArrayBuffer(44)

describe('transcribe', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('posts a wav as multipart and returns trimmed text', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = init.body as FormData
      expect(init.method).toBe('POST')
      expect(body.get('response_format')).toBe('json')
      expect(body.get('language')).toBe('el')
      expect(body.get('temperature')).toBe('0')
      expect(body.get('file')).toBeInstanceOf(Blob)
      return new Response(JSON.stringify({ text: '  Καλημέρα. \n' }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    expect(await transcribe(wav)).toBe('Καλημέρα.')
    expect(fetchMock.mock.calls[0][0]).toBe('/api/transcribe')
  })

  it('maps server errors to unavailable', async () => {
    vi.stubGlobal('fetch', async () => new Response('bad gateway', { status: 502 }))
    await expect(transcribe(wav)).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it('maps network failures to unavailable', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(transcribe(wav)).rejects.toBeInstanceOf(TranscribeError)
  })

  it('maps malformed json to unavailable', async () => {
    vi.stubGlobal('fetch', async () => new Response('<html>', { status: 200 }))
    await expect(transcribe(wav)).rejects.toMatchObject({ kind: 'unavailable' })
  })
})
