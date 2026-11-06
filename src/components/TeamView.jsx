import { useState } from 'react';
import PlayerAvatar from './PlayerAvatar.jsx';
import PlayerSheet from './PlayerSheet.jsx';
import FixtureGrid from './FixtureGrid.jsx';
import { injuryShort, playerFor, shortName } from './lookup.js';
import { RULES, fmtPrice, fmtPts } from '../core/rules.js';
import {
  canCaptain, canSwap, freeTransfersLeft, isBuildingWeek, isComplete, pendingHits, sellValue, squadIds,
} from '../core/squad.js';

// One pitch row per position, in lineup order. K and DEF share a row, as do TE and FLEX.
const ROW_KEY = { DEF: 'K', FLEX: 'TE' };
const PITCH_ROWS = Object.values(
  RULES.starterSlots.reduce((rows, slot, i) => {
    const key = ROW_KEY[slot] ?? slot;
    (rows[key] ??= []).push(i);
    return rows;
  }, {}),
);
const HAS_BENCH = RULES.benchSize > 0;

export function deadlineParts(weeks, week) {
  const w = weeks.find((x) => x.week === week);
  if (!w) return { day: '-', time: '' };
  const d = new Date(w.deadline);
  return {
    day: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
    time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  };
}

export default function TeamView({ team, actions: teamActions, playersById, weeks, openMarket }) {
  const [sheetLoc, setSheetLoc] = useState(null);
  const [swapFrom, setSwapFrom] = useState(null);
  const [view, setView] = useState('pitch');

  const at = (loc) => team[loc.list][loc.index];
  const player = (id) => playerFor(id, team, playersById);
  const proj = (id) => player(id)?.weekProj ?? 0;
  const projected = team.starters.reduce((s, id) => s + (id ? proj(id) * (id === team.captain ? RULES.captainMultiplier : 1) : 0), 0);
  const ft = freeTransfersLeft(team);
  const hits = pendingHits(team);
  const deadline = deadlineParts(weeks, team.currentWeek);

  const tap = (loc) => {
    if (swapFrom) {
      if (canSwap(team, swapFrom, loc)) teamActions.swap(swapFrom, loc);
      setSwapFrom(null);
      return;
    }
    if (!at(loc)) openMarket(loc.list === 'starters' ? RULES.starterSlots[loc.index] : 'ALL');
    else setSheetLoc(loc);
  };

  const spot = (loc) => {
    const id = at(loc);
    const p = player(id);
    const label = loc.list === 'starters' ? RULES.starterSlots[loc.index] : `BN${loc.index + 1}`;
    const isFrom = swapFrom && swapFrom.list === loc.list && swapFrom.index === loc.index;
    const cls = ['spot', !p && 'spot-empty', isFrom && 'spot-selected', swapFrom && !isFrom && (canSwap(team, swapFrom, loc) ? 'spot-target' : 'spot-dim')]
      .filter(Boolean)
      .join(' ');
    return (
      <button key={`${loc.list}-${loc.index}`} className={cls} onClick={() => tap(loc)}>
        <span className="spot-slot">{label}</span>
        {p ? (
          <>
            <span className="spot-avatar">
              <PlayerAvatar player={p} size={44} />
              {id === team.captain && <span className="armband">C</span>}
              {id === team.vice && <span className="armband vice">V</span>}
              {p.injury && <span className="inj-badge">{injuryShort(p.injury)}</span>}
            </span>
            <span className="spot-name">{shortName(p)}</span>
            <span className="spot-meta">
              {p.opponent === 'BYE' ? 'BYE' : `${p.opponent ? `v ${p.opponent} · ` : ''}${fmtPts(p.weekProj)}`}
            </span>
          </>
        ) : (
          <span className="spot-add">+</span>
        )}
      </button>
    );
  };

  const sheetId = sheetLoc ? at(sheetLoc) : null;
  const sheetPlayer = player(sheetId);
  const captainable = canCaptain(team, sheetId);
  const close = () => setSheetLoc(null);
  const actions = sheetPlayer
    ? [
        { label: captainable ? 'Captain' : `${sheetPlayer.pos}s can't captain`, disabled: !captainable || team.captain === sheetId, onClick: () => { teamActions.setRole(sheetId, 'captain'); close(); } },
        { label: 'Vice-captain', disabled: !captainable || team.vice === sheetId, onClick: () => { teamActions.setRole(sheetId, 'vice'); close(); } },
        HAS_BENCH && { label: 'Substitute', primary: true, onClick: () => { setSwapFrom(sheetLoc); close(); } },
        {
          label: `Sell (${fmtPrice(sellValue(team, sheetId, sheetPlayer.price))})`,
          danger: true,
          onClick: () => { teamActions.sell(sheetPlayer); close(); openMarket(sheetPlayer.pos); },
        },
      ].filter(Boolean)
    : [];

  return (
    <div>
      <div className="summary">
        <div><span className="muted">Week {team.currentWeek} deadline</span><strong>{deadline.day}</strong><span className="muted small">{deadline.time}</span></div>
        <div><span className="muted">Projected</span><strong>{fmtPts(projected - hits)}</strong>{hits > 0 && <span className="error small">incl. −{hits} hit</span>}</div>
        <div><span className="muted">Bank</span><strong>{fmtPrice(team.bank)}</strong></div>
        <div><span className="muted">Free transfers</span><strong>{isBuildingWeek(team) ? '∞' : ft}</strong></div>
      </div>

      {!isComplete(team) && (
        <div className="notice">
          {squadIds(team).length}/15 picked. Tap an empty spot to fill it.
        </div>
      )}
      {swapFrom && <div className="notice">Tap a highlighted spot to swap, or anywhere else to cancel.</div>}

      <div className="segmented">
        <button className={view === 'pitch' ? 'active' : ''} onClick={() => setView('pitch')}>Pitch</button>
        <button className={view === 'fixtures' ? 'active' : ''} onClick={() => setView('fixtures')}>Fixtures &amp; byes</button>
      </div>

      {view === 'fixtures' ? (
        <FixtureGrid team={team} playersById={playersById} onSelect={setSheetLoc} />
      ) : (
        <div className="pitch">
          {PITCH_ROWS.map((row, i) => (
            <div className="pitch-row" key={i}>{row.map((index) => spot({ list: 'starters', index }))}</div>
          ))}
        </div>
      )}
      {HAS_BENCH && view === 'pitch' && (
        <>
          <div className="bench-label muted small">Bench (autosub order, left to right)</div>
          <div className="bench">{team.bench.map((_, index) => spot({ list: 'bench', index }))}</div>
          <div className="row-actions">
            <button onClick={() => teamActions.autoLineup(proj)} disabled={!squadIds(team).length}>Auto-pick lineup by projection</button>
          </div>
        </>
      )}

      <PlayerSheet
        player={sheetPlayer}
        sellFor={sheetId ? sellValue(team, sheetId, sheetPlayer?.price) : null}
        actions={actions}
        onClose={close}
      />
    </div>
  );
}
