import { Fragment, useState } from 'react'
import { leaderboard, type Board } from '../../logic/city/api'
import { useT, type UiKey } from '../../logic/i18n'

const TITLES: Record<Board['category'], UiKey> = {
  points: 'board.points',
  quests: 'board.quests',
  facts: 'board.facts',
}

export function Leaderboard({ children, city }: { children: React.ReactNode; city: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [boards, setBoards] = useState<Board[] | null>(null)
  const [failed, setFailed] = useState(false)
  const show = () => {
    setOpen(true)
    leaderboard()
      .then((b) => {
        setBoards(b)
        setFailed(false)
      })
      .catch(() => setFailed(true))
  }
  return (
    <span
      className="board-anchor"
      onMouseEnter={show}
      onMouseLeave={() => setOpen(false)}
      onClick={() => (open ? setOpen(false) : show())}
    >
      {children}
      {open && (
        <div className="board-pop" role="dialog" aria-label={t('board.aria')}>
          <div className="board-title">{t('board.title', { city })}</div>
          {!boards && !failed && <div className="board-empty">{t('board.loading')}</div>}
          {failed && !boards && <div className="board-empty">{t('board.failed')}</div>}
          {boards?.map((b) => (
            <section key={b.category} className="board-section">
              <div className="board-cat">
                {t(TITLES[b.category])} <span className="board-players">{t('board.players', { n: b.players })}</span>
              </div>
              <ol className="board-rows">
                {b.rows.map((r, i) => (
                  <Fragment key={i}>
                    {i > 0 && r.rank - b.rows[i - 1].rank > 1 && <li className="board-gap">⋯</li>}
                    <li className={r.you ? 'board-row board-row-you' : 'board-row'}>
                      <span className="board-rank">{r.rank}</span>
                      <span className="board-name">{r.you ? `${r.name} ${t('board.you')}` : '••••••'}</span>
                      <span className="board-value">{r.value}</span>
                    </li>
                  </Fragment>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </span>
  )
}
