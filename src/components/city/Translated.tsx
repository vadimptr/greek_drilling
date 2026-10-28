import { useState, type ReactNode } from 'react'
import { translateCached } from '../../logic/city/api'
import { Tip } from './Tip'

interface Props {
  text: string
  children: ReactNode
  className?: string
}

export function Translated({ text, children, className }: Props) {
  const [ru, setRu] = useState<string | null>(null)
  const load = () => {
    if (ru !== null) return
    translateCached(text)
      .then(setRu)
      .catch(() => setRu('Не удалось перевести'))
  }
  return (
    <Tip text={ru} onOpen={load} className={className}>
      {children}
    </Tip>
  )
}
