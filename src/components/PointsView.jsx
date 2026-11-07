import { useEffect, useState } from 'react';
import { isWeekComplete } from '../core/gameweeks.js';
import { RULES, chipName, fmtPts } from '../core/rules.js';
import { scoreWeek, squadIds } from '../core/squad.js';

/** getScores(week, final) resolves to { [id]: { pts, played } }. */
function useWeekScores(getScores, week, final) {
  const [scores, setScores] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let live = true;
    getScores(week, final)
      .then((s) => live && setScores(s))
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [getScores, week, final]);
  return { scores, error };
}

function WeekCard({ title, subtitle, getScores, week, snapshot, info, final, open: openByDefault = false }) {
  const { scores, error } = useWeekScores(getScores, week, final);
  const [open, setOpen] = useState(openByDefault);
  const result = scores ? scoreWeek(snapshot, scores, info, { final }) : null;
  const name = (id) => (id ? info[id]?.name ?? id : 'Empty');

  return (
    <div className="week-card">
      <button className="week-head" onClick={() => setOpen(!open)}>
        <span>
          <strong>{title}</strong>
          <span className="muted small"> {subtitle ?? (final ? 'Final' : 'Live')}</span>
          {snapshot.chip && <span className="chip-tag">{chipName(snapshot.chip)}</span>}
        </span>
        <span className="week-total">{error ? '!' : result ? fmtPts(result.total) : '…'}</span>
      </button>
      {error && <p className="error small">{error}</p>}
      {open && result && (
        <table className="week-table">
          <tbody>
            {[...result.rows, ...result.benchRows].map((r, i) => (
              <tr key={i} className={r.slot === 'BN' ? 'bench-row' : ''}>
                <td className="muted">{r.slot}</td>
                <td>
                  {name(r.id)}
                  {r.mult > 1 && <span className="armband inline">{r.mult > RULES.captainMultiplier ? `×${r.mult}` : 'C'}</span>}
                  {r.bonus > 0 && <span className="chip-bonus">+{fmtPts(r.bonus)}</span>}
                  {r.subbedIn && <span className="muted small"> ↑ sub</span>}
                  {r.id && !r.played && final && <span className="muted small"> (DNP)</span>}
                </td>
                <td className="num">{fmtPts(r.pts)}</td>
              </tr>
            ))}
            {result.chip && result.chip !== 'freeHit' && (
              <tr><td /><td>{chipName(result.chip)}</td><td className="num ok">+{fmtPts(result.chipPts)}</td></tr>
            )}
            {result.hits > 0 && (
              <tr><td /><td className="error">Transfer hits</td><td className="num error">−{result.hits}</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function PointsView({ team, weeks, getScores }) {
  const locked = Object.keys(team.history).map(Number).sort((a, b) => b - a);
  const lastComplete = [...weeks].reverse().find((w) => w.complete && w.week < team.currentWeek)?.week;

  return (
    <div>
      {locked.length === 0 ? (
        <div className="notice">
          Your first gameweek is Week {team.currentWeek}. Scores will appear here once its deadline passes.
        </div>
      ) : (
        locked.map((w) => (
          <WeekCard
            key={w}
            title={`Week ${w}`}
            getScores={getScores}
            week={w}
            snapshot={team.history[w]}
            info={team.info}
            final={isWeekComplete(weeks, w)}
            open={w === locked[0]}
          />
        ))
      )}

      {lastComplete && squadIds(team).length > 0 && !team.history[lastComplete] && (
        <>
          <h3 className="section">What if?</h3>
          <WeekCard
            title={`Current lineup in Week ${lastComplete}`}
            subtitle={RULES.benchSize ? '(with autosubs, no hits)' : '(no hits)'}
            getScores={getScores}
            week={lastComplete}
            snapshot={{ starters: team.starters, bench: team.bench, captain: team.captain, vice: team.vice, hits: 0 }}
            info={team.info}
            final
            open={locked.length === 0}
          />
        </>
      )}
    </div>
  );
}
