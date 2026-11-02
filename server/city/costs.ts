export interface Prices {
  input: number
  output: number
  cacheWrite: number
  cacheRead: number
  sttHour: number
  tts1k: number
}

export const DEFAULT_PRICES: Prices = { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1, sttHour: 0.4, tts1k: 0.1 }

const PRICE_KEYS: Record<string, keyof Prices> = {
  input: 'input',
  output: 'output',
  cache_write: 'cacheWrite',
  cache_read: 'cacheRead',
  stt_hour: 'sttHour',
  tts_1k: 'tts1k',
}

export function parsePrices(raw: string | undefined): Prices {
  const prices = { ...DEFAULT_PRICES }
  for (const pair of (raw ?? '').split(',')) {
    const [key, value] = pair.split('=').map((x) => x.trim())
    const field = PRICE_KEYS[key ?? '']
    const n = Number(value)
    if (field && value && Number.isFinite(n) && n >= 0) prices[field] = n
  }
  return prices
}

export interface Usage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
}

export type Meter = (usage: Usage) => void

export interface Cost {
  usd: number
  tokensIn: number
  tokensOut: number
  sttSeconds: number
  ttsChars: number
}

export const noCost = (): Cost => ({ usd: 0, tokensIn: 0, tokensOut: 0, sttSeconds: 0, ttsChars: 0 })

export function addClaude(cost: Cost, prices: Prices, u: Usage): void {
  const write = u.cache_creation_input_tokens ?? 0
  const read = u.cache_read_input_tokens ?? 0
  cost.tokensIn += u.input_tokens + write + read
  cost.tokensOut += u.output_tokens
  cost.usd += (u.input_tokens * prices.input + write * prices.cacheWrite + read * prices.cacheRead + u.output_tokens * prices.output) / 1_000_000
}

export function addStt(cost: Cost, prices: Prices, seconds: number): void {
  cost.sttSeconds += seconds
  cost.usd += (seconds / 3600) * prices.sttHour
}

export function addTts(cost: Cost, prices: Prices, chars: number): void {
  cost.ttsChars += chars
  cost.usd += (chars / 1000) * prices.tts1k
}

export function addCost(into: Cost, from: Cost): void {
  into.usd += from.usd
  into.tokensIn += from.tokensIn
  into.tokensOut += from.tokensOut
  into.sttSeconds += from.sttSeconds
  into.ttsChars += from.ttsChars
}
