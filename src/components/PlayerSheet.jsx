import { useEffect, useState } from 'react';
import PlayerAvatar from './PlayerAvatar.jsx';
import { byeWeek, useFixtures, useSeason } from './season.js';
import { fixtureLabel } from '../core/gameweeks.js';
import { fmtPrice, fmtPts } from '../core/rules.js';

/** Bottom sheet with a player's numbers and whatever actions the caller passes in. */
export default function PlayerSheet({ player, ...props }) {
  // Keyed by player so the game log starts closed for each new player.
  return player ? <Sheet key={player.id} player={player} {...props} /> : null;
}

function Sheet({ player, sellFor, actions = [], onClose }) {
  const fixturesOf = useFixtures();
  const [showLog, setShowLog] = useState(false);
  const bye = byeWeek(fixturesOf(player.team));
  const stats = [
    ['Price', player.price != null ? fmtPrice(player.price) : '-'],
    sellFor != null && ['Sells for', fmtPrice(sellFor)],
    ['Next week', player.opponent === 'BYE' ? 'Bye' : `${fmtPts(player.weekProj)} proj${player.opponent ? ` v ${player.opponent}` : ''}`],
    bye && ['Bye week', `Week ${bye}`],
    ['Season', player.gp ? `${fmtPts(player.seasonPts)} pts in ${player.gp} gm (${fmtPts(player.seasonPpg)}/gm)` : 'No games yet', () => setShowLog(!showLog)],
    ['Preseason proj', player.projPpg != null ? `${fmtPts(player.projPpg)}/gm` : '-'],
    player.snapPct != null && ['Snap share', `${player.snapPct}%`],
    ['Value (pricing)', `${fmtPts(player.value)} pts/gm`],
  ].filter(Boolean);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <PlayerAvatar player={player} size={64} />
          <div>
            <div className="sheet-name">{player.name}</div>
            <div className="muted">
              <span className={`pos-tag pos-${player.pos}`}>{player.pos}</span> {player.team}
            </div>
            {player.injury && (
              <div className="error small">
                {player.injury.status}{player.injury.part ? ` (${player.injury.part})` : ''}
              </div>
            )}
          </div>
        </div>
        <dl className="sheet-stats">
          {stats.map(([k, v, onClick]) =>
            onClick ? (
              <div
                key={k}
                className={`stat-button ${showLog ? 'open' : ''}`}
                role="button"
                tabIndex={0}
                aria-expanded={showLog}
                onClick={onClick}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick())}
              >
                <dt>{k} <span className="stat-hint">{showLog ? 'Hide game log ▴' : 'Game log ▾'}</span></dt>
                <dd>{v}</dd>
              </div>
            ) : (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ),
          )}
        </dl>
        {showLog && <GameLog player={player} fixtures={fixturesOf(player.team)} />}
        <div className="sheet-actions">
          {actions.map((a) => (
            <button key={a.label} className={a.primary ? 'primary' : a.danger ? 'danger' : ''} disabled={a.disabled} onClick={a.onClick}>
              {a.label}
            </button>
          ))}
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/** Every week of the season: results so far, then the fixtures to come. */
function GameLog({ player, fixtures }) {
  const { week: openWeek, getLog } = useSeason();
  const [log, setLog] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!getLog) return undefined;
    let live = true;
    setLog(null);
    setError(null);
    getLog(player).then(
      (rows) => live && setLog(new Map(rows.map((r) => [r.week, r]))),
      (e) => live && setError(e.message),
    );
    return () => { live = false; };
  }, [player.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!fixtures.length) return null;
  const current = openWeek ?? fixtures.length + 1;
  const result = (f) => {
    if (f.bye) return '';
    if (f.week === current) return player.weekProj != null ? `${fmtPts(player.weekProj)} proj` : '';
    if (f.week > current) return '';
    // A locked week whose game hasn't finished yet (live play mid-week) isn't a DNP.
    if (f.status === 'pre_game') return 'to play';
    if (!log) return error ? '!' : '…';
    const r = log.get(f.week);
    if (f.status === 'in_game') return r ? `${fmtPts(r.pts)} live` : 'live';
    return r?.played ? fmtPts(r.pts) : 'DNP';
  };

  return (
    <>
      {error && <p className="error small">Couldn't load results: {error}</p>}
      <table className="week-table log-table">
        <tbody>
          {fixtures.map((f) => (
            <tr key={f.week} className={f.bye ? 'bye-row' : f.week === current ? 'current-row' : f.week > current ? 'future-row' : ''}>
              <td className="muted">Wk {f.week}</td>
              <td>{fixtureLabel(f)}{f.week === current && <span className="muted small"> · next</span>}</td>
              <td className="num">{result(f)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
