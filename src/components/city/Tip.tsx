import { useState, type ReactNode } from 'react'

interface Props {
  text: string | null
  children: ReactNode
  align?: 'center' | 'right'
  placement?: 'above' | 'below'
  className?: string
  onOpen?: () => void
}

export function Tip({ text, children, align = 'center', placement = 'above', className, onOpen }: Props) {
  const [open, setOpen] = useState(false)
  const show = (value: boolean) => {
    if (value && !open) onOpen?.()
    setOpen(value)
  }
  return (
    <span
      className={`tip ${className ?? ''}`}
      onMouseEnter={() => show(true)}
      onMouseLeave={() => show(false)}
      onClick={(e) => {
        e.stopPropagation()
        show(!open)
      }}
    >
      {children}
      {open && (
        <span className={`tip-pop tip-pop-${align} tip-pop-${placement}`} role="tooltip">
          {text ?? '…'}
        </span>
      )}
    </span>
  )
}
