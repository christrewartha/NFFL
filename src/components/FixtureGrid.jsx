import { Fragment } from 'react';
import { playerFor, shortName } from './lookup.js';
import { useFixtures, useSeason } from './season.js';
import { fixtureLabel } from '../core/gameweeks.js';
import { RULES } from '../core/rules.js';

const WEEKS_SHOWN = 6;

/**
 * The squad against the next few weeks of fixtures, with byes highlighted and counted,
 * so managers can plan transfers around them. onSelect(loc) opens a player.
 */
export default function FixtureGrid({ team, playersById, onSelect }) {
  const { week, schedule } = useSeason();
  const fixturesOf = useFixtures();
  const total = Math.max(0, ...schedule.map((g) => g.week));
  const first = week ?? total + 1;
  const weeks = Array.from({ length: Math.max(0, Math.min(WEEKS_SHOWN, total - first + 1)) }, (_, i) => first + i);
  if (!weeks.length) return <p className="muted">The season is over.</p>;

  const rows = [
    ...team.starters.map((id, index) => ({ id, slot: RULES.starterSlots[index], loc: { list: 'starters', index } })),
    ...team.bench.map((id, index) => ({ id, slot: 'BN', loc: { list: 'bench', index } })),
  ]
    .filter((r) => r.id)
    .map((r) => ({ ...r, player: playerFor(r.id, team, playersById) }))
    .map((r) => ({ ...r, fixtures: fixturesOf(r.player.team) }));
  const byes = (w) => rows.filter((r) => r.fixtures[w - 1]?.bye).length;

  return (
    <div className="fixture-grid">
      <table>
        <thead>
          <tr>
            <th />
            {weeks.map((w) => (
              <th key={w}>
                Wk {w}
                <span className={`bye-count ${byes(w) ? 'has-byes' : ''}`}>{byes(w) ? `${byes(w)} bye` : '-'}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <Fragment key={r.id}>
              {RULES.freePositions.includes(r.slot) && !RULES.freePositions.includes(rows[i - 1]?.slot) && (
                <tr className="fg-divider"><td colSpan={weeks.length + 1}>Free picks</td></tr>
              )}
              <tr onClick={() => onSelect(r.loc)}>
                <td className="fg-player"><span className={`pos-tag pos-${r.player.pos}`}>{r.slot}</span> {shortName(r.player)}</td>
                {weeks.map((w) => {
                  const f = r.fixtures[w - 1];
                  return <td key={w} className={f?.bye ? 'bye' : ''}>{fixtureLabel(f)}</td>;
                })}
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="muted small">Pick some players to see their fixtures.</p>}
    </div>
  );
}
