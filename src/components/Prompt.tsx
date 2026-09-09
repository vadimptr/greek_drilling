import type { Direction, Pos, Word } from '../types/word'
import { promptOf } from '../logic/options'

const POS_LABEL: Record<Pos, string> = {
  noun: 'существительное',
  verb: 'глагол',
  adj: 'прилагательное',
  adv: 'наречие',
  pron: 'местоимение',
  prep: 'предлог',
  conj: 'союз',
  num: 'числительное',
  phrase: 'фраза',
  other: '',
}

interface Props {
  word: Word
  direction: Direction
}

export function Prompt({ word, direction }: Props) {
  return (
    <main className="prompt">
      <div key={word.id} className="prompt-word">
        {promptOf(word, direction)}
      </div>
      <div className="prompt-pos">{POS_LABEL[word.pos]}</div>
    </main>
  )
}
