import { useState, type ReactNode } from 'react'
import { translateCached } from '../../logic/city/api'
import { useT } from '../../logic/i18n'
import { Tip } from './Tip'

interface Props {
  text: string
  children: ReactNode
  className?: string
}

export function Translated({ text, children, className }: Props) {
  const t = useT()
  const [ru, setRu] = useState<string | null>(null)
  const load = () => {
    if (ru !== null) return
    translateCached(text)
      .then(setRu)
      .catch(() => setRu(t('city.untranslatable')))
  }
  return (
    <Tip text={ru} onOpen={load} className={className}>
      {children}
    </Tip>
  )
}
