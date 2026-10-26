export type Pos =
  | 'noun'
  | 'verb'
  | 'adj'
  | 'adv'
  | 'pron'
  | 'prep'
  | 'conj'
  | 'num'
  | 'phrase'
  | 'other'

export interface Word {
  id: number
  el: string
  ru: string
  pos: Pos
  topic: string
}

export type Direction = 'el-ru' | 'ru-el'

export type Level = 'A1' | 'A2' | 'B1'

export const LEVELS: Level[] = ['A1', 'A2', 'B1']
