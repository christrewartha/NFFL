import { useEffect, useState } from 'react';
import { fmtPts } from '../core/rules.js';

/** League table. Tap a manager to see their team from the last locked week. */
export default function LeagueView({ api }) {
  const [standings, setStandings] = useState(null);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    api('/api/league').then((d) => setStandings(d.standings), (e) => setError(e.message));
  }, [api]);

  if (error) return <p className="error">{error}</p>;
  if (!standings) return <p className="muted">Loading…</p>;

  return (
    <div>
      <table className="standings">
        <thead><tr><th>#</th><th>Manager</th><th className="num">Last wk</th><th className="num">Total</th></tr></thead>
        <tbody>
          {standings.map((m, i) => (
            <Row key={m.id} m={m} rank={i + 1} open={openId === m.id} toggle={() => setOpenId(openId === m.id ? null : m.id)} />
          ))}
        </tbody>
      </table>
      {standings.every((m) => !m.weekly.length) && <p className="muted small">Points appear after the first deadline.</p>}
    </div>
  );
}

function Row({ m, rank, open, toggle }) {
  const last = m.weekly.at(-1);
  return (
    <>
      <tr className={m.isMe ? 'me' : ''} onClick={toggle}>
        <td>{rank}</td>
        <td>{m.name}</td>
        <td className="num">{last ? fmtPts(last.total) : '-'}</td>
        <td className="num"><strong>{fmtPts(m.total)}</strong></td>
      </tr>
      {open && (
        <tr className="standings-detail">
          <td colSpan={4}>
            {m.latest ? (
              <>
                <div className="muted small">Week {m.latest.week}</div>
                <table className="week-table">
                  <tbody>
                    {m.latest.rows.map((r, i) => (
                      <tr key={i}>
                        <td className="muted">{r.slot}</td>
                        <td>{r.name ?? 'Empty'}{r.mult > 1 && <span className="armband inline">C</span>}</td>
                        <td className="num">{fmtPts(r.pts)}</td>
                      </tr>
                    ))}
                    {m.latest.hits > 0 && <tr><td /><td className="error">Transfer hits</td><td className="num error">−{m.latest.hits}</td></tr>}
                  </tbody>
                </table>
              </>
            ) : (
              <span className="muted small">No locked weeks yet.</span>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
