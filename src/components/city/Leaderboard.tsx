import { Fragment, useState } from 'react'
import { leaderboard, type Board } from '../../logic/city/api'

const TITLES: Record<Board['category'], string> = {
  points: '⭐ Очки',
  quests: '🎯 Выполнено заданий',
  facts: '📓 Найдено фактов',
}

export function Leaderboard({ children }: { children: React.ReactNode }) {
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
        <div className="board-pop" role="dialog" aria-label="Лидерборд">
          <div className="board-title">🏆 Лидерборд Μυθόπολη</div>
          {!boards && !failed && <div className="board-empty">Загружаю…</div>}
          {failed && !boards && <div className="board-empty">Не удалось загрузить</div>}
          {boards?.map((b) => (
            <section key={b.category} className="board-section">
              <div className="board-cat">
                {TITLES[b.category]} <span className="board-players">· игроков: {b.players}</span>
              </div>
              <ol className="board-rows">
                {b.rows.map((r, i) => (
                  <Fragment key={i}>
                    {i > 0 && r.rank - b.rows[i - 1].rank > 1 && <li className="board-gap">⋯</li>}
                    <li className={r.you ? 'board-row board-row-you' : 'board-row'}>
                      <span className="board-rank">{r.rank}</span>
                      <span className="board-name">{r.you ? `${r.name} (ты)` : '••••••'}</span>
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
