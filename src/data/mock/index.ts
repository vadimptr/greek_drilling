import type { MockVariant } from '../../types/mock'
import { LEVELS, type Level } from '../../types/word'
import { VARIANT_1 } from './variant1'
import { VARIANT_2 } from './variant2'
import { VARIANT_3 } from './variant3'
import { A2_VARIANT_1 } from './a2-variant1'
import { A2_VARIANT_2 } from './a2-variant2'
import { A2_VARIANT_3 } from './a2-variant3'
import { B1_VARIANT_1 } from './b1-variant1'
import { B1_VARIANT_2 } from './b1-variant2'
import { B1_VARIANT_3 } from './b1-variant3'

const BY_LEVEL: Record<Level, MockVariant[]> = {
  A1: [VARIANT_1, VARIANT_2, VARIANT_3],
  A2: [A2_VARIANT_1, A2_VARIANT_2, A2_VARIANT_3],
  B1: [B1_VARIANT_1, B1_VARIANT_2, B1_VARIANT_3],
}

export const VARIANTS: MockVariant[] = LEVELS.flatMap((l) => BY_LEVEL[l])

export function variantsFor(level: Level): MockVariant[] {
  return BY_LEVEL[level]
}

export function variantLevel(id: number): Level {
  return LEVELS.find((l) => BY_LEVEL[l].some((v) => v.id === id)) ?? 'A1'
}

export function variantTitle(id: number): string {
  const variant = VARIANTS.find((v) => v.id === id)
  return `${variantLevel(id)} · ${variant?.title ?? `Вариант ${id}`}`
}
