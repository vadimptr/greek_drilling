import { useEffect, useState, type FormEvent } from 'react'
import { enter, type Session } from '../logic/account'
import { NAME_MAX, nameError } from '../logic/name'

interface Props {
  open: boolean
  user: string | null
  onSignIn: (session: Session) => void
  onSignOut: () => void
  onClose: () => void
}

export function AccountSheet({ open, user, onSignIn, onSignOut, onClose }: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) {
      setError(null)
      setConfirm(false)
      setBusy(false)
    }
  }, [open])

  if (!open) return null

  const submit = async (create: boolean) => {
    const invalid = nameError(name)
    if (invalid) {
      setError(invalid)
      return
    }
    setBusy(true)
    setError(null)
    const r = await enter(name, create)
    setBusy(false)
    if (r.kind === 'missing') {
      setConfirm(true)
      return
    }
    if (r.kind === 'error') {
      setError(r.message)
      return
    }
    setName('')
    setConfirm(false)
    onSignIn(r.session)
    onClose()
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void submit(false)
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        {user ? (
          <>
            <h2 className="sheet-title">Аккаунт</h2>
            <div className="account-name">👤 {user}</div>
            <div className="sheet-label">Прогресс сохраняется на сервере — войдите под этим именем на любом устройстве.</div>
            <button
              className="danger-btn"
              onClick={() => {
                onSignOut()
                onClose()
              }}
            >
              Выйти
            </button>
            <button className="secondary-btn" onClick={onClose}>
              Закрыть
            </button>
          </>
        ) : confirm ? (
          <>
            <h2 className="sheet-title">Новый аккаунт</h2>
            <div>
              Такого имени ещё нет — создать аккаунт <b>{name.trim()}</b>?
            </div>
            {error && <div className="account-error">{error}</div>}
            <button className="primary-btn" disabled={busy} onClick={() => void submit(true)}>
              Создать
            </button>
            <button className="secondary-btn" disabled={busy} onClick={() => setConfirm(false)}>
              Исправить
            </button>
          </>
        ) : (
          <form className="account-form" onSubmit={onSubmit}>
            <h2 className="sheet-title">Вход</h2>
            <div className="sheet-label">
              Придумайте имя и входите под ним на любом устройстве — прогресс будет общий. Пароль не нужен.
            </div>
            <input
              className="account-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value.replace(/\s/g, ''))
                setError(null)
              }}
              placeholder="Ваше имя"
              maxLength={NAME_MAX}
              autoComplete="username"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
            />
            <div className="sheet-label">3–{NAME_MAX} символа: буквы, цифры, _ и -</div>
            {error && <div className="account-error">{error}</div>}
            <button className="primary-btn" type="submit" disabled={busy || name.length === 0}>
              Продолжить
            </button>
            <button className="secondary-btn" type="button" onClick={onClose}>
              Без входа
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
