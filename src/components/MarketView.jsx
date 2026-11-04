import { useMemo, useState } from 'react';
import PlayerAvatar from './PlayerAvatar.jsx';
import PlayerSheet from './PlayerSheet.jsx';
import { injuryShort, playerFor } from './lookup.js';
import { POSITIONS, RULES, SLOT_ELIGIBLE, fmtPrice, fmtPts } from '../core/rules.js';
import {
  cannotAdd, countBy, freeTransfersLeft, isBuildingWeek, minCostToFill, pendingHits,
  sellValue, squadIds, transfersMade,
} from '../core/squad.js';

const FILTERS = ['ALL', ...POSITIONS, 'FLEX', 'SQUAD'];
const SORTS = {
  price: { label: 'Price', key: (p) => p.price },
  value: { label: 'Value', key: (p) => p.value },
  week: { label: 'Next wk', key: (p) => p.weekProj ?? -1 },
  season: { label: 'Season', key: (p) => p.seasonPts ?? 0 },
};
const LIMIT = 150;

export default function MarketView({ team, actions: teamActions, market, playersById, filter, setFilter }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('price');
  const [affordable, setAffordable] = useState(false);
  const [sheetId, setSheetId] = useState(null);

  const owned = new Set(squadIds(team));
  const counts = countBy(team, 'pos');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = filter === 'SQUAD' ? squadIds(team).map((id) => playerFor(id, team, playersById)) : market.players;
    return pool
      .filter((p) => filter === 'ALL' || filter === 'SQUAD' || (SLOT_ELIGIBLE[filter] ?? [filter]).includes(p.pos))
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.team.toLowerCase() === q)
      .filter((p) => !affordable || owned.has(p.id) || p.price <= team.bank)
      .sort((a, b) => SORTS[sort].key(b) - SORTS[sort].key(a));
  }, [market, team, filter, query, sort, affordable]); // eslint-disable-line react-hooks/exhaustive-deps

  const { buy, sell } = teamActions;

  const sheetPlayer = sheetId ? playerFor(sheetId, team, playersById) : null;
  const sheetOwned = sheetId && owned.has(sheetId);
  const sheetBlock = sheetPlayer && !sheetOwned ? cannotAdd(team, sheetPlayer) : null;
  const actions = !sheetPlayer
    ? []
    : sheetOwned
      ? [{ label: `Sell (${fmtPrice(sellValue(team, sheetId, sheetPlayer.price))})`, danger: true, onClick: () => { sell(sheetPlayer); setSheetId(null); } }]
      : [{ label: sheetBlock ?? `Buy (${fmtPrice(sheetPlayer.price)})`, primary: true, disabled: Boolean(sheetBlock), onClick: () => { buy(sheetPlayer); setSheetId(null); } }];

  const made = transfersMade(team);
  const hits = pendingHits(team);
  const needed = minCostToFill(team, market.players);

  return (
    <div>
      <div className="summary">
        <div><span className="muted">Bank</span><strong>{fmtPrice(team.bank)}</strong></div>
        <div><span className="muted">Squad</span><strong>{owned.size}/15</strong></div>
        <div>
          <span className="muted">Transfers</span>
          <strong>{isBuildingWeek(team) ? 'Free' : `${made} made`}</strong>
          {!isBuildingWeek(team) && <span className="muted small">{freeTransfersLeft(team)} free left</span>}
        </div>
        <div><span className="muted">Cost</span><strong className={hits ? 'error' : ''}>{hits ? `−${hits} pts` : '0'}</strong></div>
      </div>

      {needed > team.bank && (
        <div className="notice error">
          The cheapest way to fill your empty spots costs {fmtPrice(needed)}, but you have {fmtPrice(team.bank)}. Sell someone pricey.
        </div>
      )}

      <div className="quota">
        {POSITIONS.map((pos) => (
          <span key={pos} className={`quota-item ${(counts[pos] ?? 0) === RULES.squad[pos] ? 'full' : ''}`}>
            <span className={`pos-tag pos-${pos}`}>{pos}</span> {counts[pos] ?? 0}/{RULES.squad[pos]}
          </span>
        ))}
      </div>

      <div className="chips">
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f === 'SQUAD' ? 'My squad' : f}</button>
        ))}
      </div>
      <div className="toolbar">
        <input type="search" placeholder="Search name or team (e.g. KC)" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>Sort: {s.label}</option>)}
        </select>
        <label className="toggle"><input type="checkbox" checked={affordable} onChange={(e) => setAffordable(e.target.checked)} /> Affordable</label>
      </div>

      <div className="market-head muted small">
        <span>Player</span><span>Avg</span><span>Next wk</span><span>Price</span><span />
      </div>
      <ul className="market">
        {list.slice(0, LIMIT).map((p) => {
          const mine = owned.has(p.id);
          const block = mine ? null : cannotAdd(team, p);
          return (
            <li key={p.id} className={mine ? 'mine' : ''}>
              <button className="market-player" onClick={() => setSheetId(p.id)}>
                <PlayerAvatar player={p} size={36} />
                <span className="market-name">
                  <span>{p.name}{p.injury && <span className="inj-inline">{injuryShort(p.injury)}</span>}</span>
                  <span className="muted small">
                    <span className={`pos-tag pos-${p.pos}`}>{p.pos}</span> {p.team}
                    {p.opponent && ` · ${p.opponent === 'BYE' ? 'BYE' : `v ${p.opponent}`}`}
                  </span>
                </span>
              </button>
              <span className="num">{fmtPts(p.seasonPpg)}</span>
              <span className="num">{p.opponent === 'BYE' ? '-' : fmtPts(p.weekProj)}</span>
              <span className="num price">{p.price != null ? fmtPrice(p.price) : '-'}</span>
              {mine ? (
                <button className="mini danger" onClick={() => sell(p)} title={`Sell for ${fmtPrice(sellValue(team, p.id, p.price))}`}>−</button>
              ) : (
                <button className="mini primary" disabled={Boolean(block)} onClick={() => buy(p)} title={block ?? 'Buy'}>+</button>
              )}
            </li>
          );
        })}
      </ul>
      {list.length > LIMIT && <p className="muted small center">Showing {LIMIT} of {list.length}. Search or filter to narrow down.</p>}
      {!list.length && <p className="muted center">No players match.</p>}

      <PlayerSheet
        player={sheetPlayer}
        sellFor={sheetOwned ? sellValue(team, sheetId, sheetPlayer.price) : null}
        actions={actions}
        onClose={() => setSheetId(null)}
      />
    </div>
  );
}
