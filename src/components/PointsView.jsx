import { useEffect, useState } from 'react';
import { isWeekComplete } from '../core/gameweeks.js';
import { RULES, chipName, fmtPts } from '../core/rules.js';
import { scoreWeek, squadIds, weekSnapshot } from '../core/squad.js';

const LIVE_REFRESH = 2 * 60 * 1000;

/** getScores(week, final) resolves to { [id]: { pts, played } }. Refreshed every couple of minutes until final. */
function useWeekScores(getScores, week, final) {
  const [scores, setScores] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let live = true;
    const load = () => getScores(week, final)
      .then((s) => live && (setScores(s), setError(null)))
      .catch((e) => live && setError(e.message));
    load();
    const timer = final ? null : setInterval(load, LIVE_REFRESH);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [getScores, week, final]);
  return { scores, error };
}

/** `locks` (the week in play): players whose game hasn't kicked off are marked "to play". */
function WeekCard({ title, subtitle, getScores, week, snapshot, info, final, locks, open: openByDefault = false }) {
  const { scores, error } = useWeekScores(getScores, week, final);
  const toPlay = (id) => Boolean(locks && id && !locks.teams.has(info[id]?.team));
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
                  {toPlay(r.id) && <span className="muted small"> · to play</span>}
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

/** `locks` (online league): set once the current week has kicked off, which adds its live card. */
export default function PointsView({ team, weeks, getScores, locks }) {
  const locked = Object.keys(team.history).map(Number).sort((a, b) => b - a);
  const lastComplete = [...weeks].reverse().find((w) => w.complete && !w.preLeague && w.week < team.currentWeek)?.week;
  const inPlay = locks?.chips && weeks.some((w) => w.week === team.currentWeek && w.locked && !w.complete);

  return (
    <div>
      {inPlay && (
        <WeekCard
          title={`Week ${team.currentWeek}`}
          subtitle="Live"
          getScores={getScores}
          week={team.currentWeek}
          snapshot={weekSnapshot(team)}
          info={team.info}
          final={false}
          locks={locks}
          open
        />
      )}
      {locked.length === 0 ? (
        !inPlay && (
          <div className="notice">
            Your first gameweek is Week {team.currentWeek}. Scores will appear here once {locks ? 'its first game kicks off' : 'its deadline passes'}.
          </div>
        )
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
            open={!inPlay && w === locked[0]}
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
