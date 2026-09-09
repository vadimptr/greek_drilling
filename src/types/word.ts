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
