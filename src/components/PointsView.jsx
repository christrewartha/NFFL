import { Fragment, useEffect, useState } from 'react';
import PlayerAvatar from './PlayerAvatar.jsx';
import { FREE_ROW, FreePicksDivider, PITCH_ROWS } from './TeamView.jsx';
import { shortName } from './lookup.js';
import { isWeekComplete } from '../core/gameweeks.js';
import { RULES, chipName, fmtPts } from '../core/rules.js';
import { scoreWeek, squadIds, weekSnapshot } from '../core/squad.js';

const LIVE_REFRESH = 2 * 60 * 1000;
const HAS_BENCH = RULES.benchSize > 0;

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

/**
 * One gameweek laid out on the pitch like the Team tab, each player showing his points.
 * `locks` (the week in play): players whose game hasn't kicked off are marked "to play".
 */
function WeekPitch({ getScores, week, snapshot, info, final, locks }) {
  const { scores, error } = useWeekScores(getScores, week, final);
  const result = scores ? scoreWeek(snapshot, scores, info, { final }) : null;
  const toPlay = (id) => Boolean(locks && id && !locks.teams.has(info[id]?.team));

  const spot = (r, key) => {
    const p = r.id ? { id: r.id, name: r.id, pos: '', ...info[r.id] } : null;
    const pending = toPlay(r.id);
    const dnp = final && r.id && !r.played;
    const cls = ['spot', !p && 'spot-empty', (r.slot === 'BN' || dnp) && 'spot-faded'].filter(Boolean).join(' ');
    return (
      <div key={key} className={cls}>
        <span className="spot-slot">{r.slot}</span>
        {p ? (
          <>
            <span className="spot-avatar">
              <PlayerAvatar player={p} size={44} />
              {r.mult > 1 && <span className="armband">{r.mult > RULES.captainMultiplier ? `×${r.mult}` : 'C'}</span>}
              {r.mult === 1 && r.id === snapshot.vice && r.slot !== 'BN' && <span className="armband vice">V</span>}
              {r.subbedIn && <span className="sub-badge" title="Autosubbed in">↑</span>}
            </span>
            <span className="spot-name">{shortName(p)}</span>
            <span className={`spot-pts${pending ? ' pending' : ''}`}>
              {pending ? 'to play' : dnp ? 'DNP' : result ? fmtPts(r.pts) : '…'}
            </span>
            {r.bonus > 0 && <span className="spot-meta chip-bonus">+{fmtPts(r.bonus)} {chipName(snapshot.chip)}</span>}
          </>
        ) : (
          <span className="spot-add">–</span>
        )}
      </div>
    );
  };

  // Before the scores arrive, lay the snapshot out with no points so the pitch doesn't jump.
  const rows = result?.rows ?? snapshot.starters.map((id, i) => ({ slot: RULES.starterSlots[i], id, pts: 0, mult: id && id === snapshot.captain ? RULES.captainMultiplier : 1, bonus: 0 }));
  const benchRows = result?.benchRows ?? snapshot.bench.map((id) => ({ slot: 'BN', id, pts: 0, mult: 1, bonus: 0 }));
  const played = result ? result.rows.filter((r) => r.id && r.played).length : null;

  return (
    <>
      <div className="summary">
        <div>
          <span className="muted">{final ? 'Final' : 'Live'}</span>
          <strong className="ok">{error ? '!' : result ? fmtPts(result.total) : '…'}</strong>
          {result?.hits > 0 && <span className="error small">incl. −{result.hits} hit</span>}
        </div>
        <div><span className="muted">Played</span><strong>{played == null ? '…' : `${played}/${rows.length}`}</strong></div>
        <div>
          <span className="muted">Chip</span>
          <strong>{snapshot.chip ? chipName(snapshot.chip) : '-'}</strong>
          {result?.chip && result.chip !== 'freeHit' && <span className="ok small">+{fmtPts(result.chipPts)}</span>}
        </div>
        <div><span className="muted">Bench</span><strong>{result ? fmtPts(result.benchRows.reduce((s, r) => s + r.pts, 0)) : '…'}</strong></div>
      </div>
      {error && <p className="error small">{error}</p>}

      <div className="pitch">
        {PITCH_ROWS.map((row, i) => (
          <Fragment key={i}>
            {i === FREE_ROW && <FreePicksDivider label="Free picks" />}
            <div className="pitch-row">{row.map((index) => spot(rows[index], index))}</div>
          </Fragment>
        ))}
      </div>
      {HAS_BENCH && (
        <>
          <div className="bench-label muted small">Bench{final ? ' (after autosubs)' : ''}</div>
          <div className="bench">{benchRows.map((r, i) => spot(r, `bn-${i}`))}</div>
        </>
      )}
    </>
  );
}

/** `locks` (online league): set once the current week has kicked off, which adds its live week. */
export default function PointsView({ team, weeks, getScores, locks }) {
  const inPlay = locks?.chips && weeks.some((w) => w.week === team.currentWeek && w.locked && !w.complete);
  const lastComplete = [...weeks].reverse().find((w) => w.complete && !w.preLeague && w.week < team.currentWeek)?.week;
  const whatIf = lastComplete && squadIds(team).length > 0 && !team.history[lastComplete];

  // Every week this team has played, newest first, plus the live week once it kicks off.
  const pages = [
    ...(inPlay ? [{ week: team.currentWeek, snapshot: weekSnapshot(team), final: false, locks }] : []),
    ...Object.keys(team.history).map(Number).sort((a, b) => b - a)
      .map((w) => ({ week: w, snapshot: team.history[w], final: isWeekComplete(weeks, w) })),
  ];
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState(pages.length ? 'weeks' : 'whatIf');
  const current = pages[Math.min(page, pages.length - 1)];

  return (
    <div>
      {whatIf && (
        <div className="segmented">
          <button className={mode === 'weeks' ? 'active' : ''} onClick={() => setMode('weeks')}>Your weeks</button>
          <button className={mode === 'whatIf' ? 'active' : ''} onClick={() => setMode('whatIf')}>What if?</button>
        </div>
      )}

      {mode === 'whatIf' && whatIf ? (
        <>
          <div className="notice small">
            Your current lineup in Week {lastComplete}{RULES.benchSize ? ', with autosubs' : ''} and no transfer hits.
          </div>
          <WeekPitch
            getScores={getScores}
            week={lastComplete}
            snapshot={{ starters: team.starters, bench: team.bench, captain: team.captain, vice: team.vice, hits: 0 }}
            info={team.info}
            final
          />
        </>
      ) : !current ? (
        <div className="notice">
          Your first gameweek is Week {team.currentWeek}. Scores will appear here once {locks ? 'its first game kicks off' : 'its deadline passes'}.
        </div>
      ) : (
        <>
          <div className="week-nav">
            <button onClick={() => setPage(page + 1)} disabled={page >= pages.length - 1} aria-label="Previous week">‹</button>
            <strong>Week {current.week}</strong>
            <button onClick={() => setPage(page - 1)} disabled={page <= 0} aria-label="Next week">›</button>
          </div>
          <WeekPitch
            key={current.week}
            getScores={getScores}
            week={current.week}
            snapshot={current.snapshot}
            info={team.info}
            final={current.final}
            locks={current.locks}
          />
        </>
      )}
    </div>
  );
}
