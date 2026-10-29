import { useEffect, useState, type FormEvent } from 'react'
import { enter, type Session } from '../logic/account'
import { NAME_MAX, nameError } from '../logic/name'
import { useT, useUi } from '../logic/i18n'

interface Props {
  open: boolean
  user: string | null
  onSignIn: (session: Session) => void
  onSignOut: () => void
  onClose: () => void
}

export function AccountSheet({ open, user, onSignIn, onSignOut, onClose }: Props) {
  const t = useT()
  const ui = useUi()
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
      setError(ui === 'ru' ? invalid : t('account.rules', { max: NAME_MAX }))
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
            <h2 className="sheet-title">{t('account.title')}</h2>
            <div className="account-name">👤 {user}</div>
            <div className="sheet-label">{t('account.saved')}</div>
            <button
              className="danger-btn"
              onClick={() => {
                onSignOut()
                onClose()
              }}
            >
              {t('account.signOut')}
            </button>
            <button className="secondary-btn" onClick={onClose}>
              {t('common.close')}
            </button>
          </>
        ) : confirm ? (
          <>
            <h2 className="sheet-title">{t('account.new')}</h2>
            <div>
              {t('account.create?')} <b>{name.trim()}</b>?
            </div>
            {error && <div className="account-error">{error}</div>}
            <button className="primary-btn" disabled={busy} onClick={() => void submit(true)}>
              {t('account.create')}
            </button>
            <button className="secondary-btn" disabled={busy} onClick={() => setConfirm(false)}>
              {t('account.fix')}
            </button>
          </>
        ) : (
          <form className="account-form" onSubmit={onSubmit}>
            <h2 className="sheet-title">{t('account.signIn')}</h2>
            <div className="sheet-label">{t('account.howto')}</div>
            <input
              className="account-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value.replace(/\s/g, ''))
                setError(null)
              }}
              placeholder={t('account.placeholder')}
              maxLength={NAME_MAX}
              autoComplete="username"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
            />
            <div className="sheet-label">{t('account.rules', { max: NAME_MAX })}</div>
            {error && <div className="account-error">{error}</div>}
            <button className="primary-btn" type="submit" disabled={busy || name.length === 0}>
              {t('account.continue')}
            </button>
            <button className="secondary-btn" type="button" onClick={onClose}>
              {t('account.skip')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
