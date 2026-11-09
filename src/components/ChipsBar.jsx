import { useState } from 'react';
import { CHIPS } from '../core/rules.js';
import { activeChip, cannotPlayChip } from '../core/squad.js';

/**
 * The season's chips, one button each. Playing one adds it to the pending changes, so it's
 * confirmed with them and can be cancelled until then. Once saved it's played for good.
 * `team` is the draft, `saved` the confirmed team. `locks`: chips close at the first kickoff.
 */
export default function ChipsBar({ team, saved, actions, locks }) {
  const [openId, setOpenId] = useState(null);
  const active = activeChip(team);
  const savedActive = saved ? activeChip(saved) : active;

  const statusOf = (id) => {
    if (id === savedActive) return { cls: 'chip-on', text: 'Playing' };
    if (id === active) return { cls: 'chip-pending', text: 'To confirm' };
    const used = team.chipsUsed?.[id];
    if (used != null) return { cls: 'chip-used', text: `Wk ${used}` };
    return cannotPlayChip(team, id, locks) ? { cls: 'chip-blocked', text: 'Available' } : { cls: '', text: 'Available' };
  };

  const chip = CHIPS.find((c) => c.id === openId);
  const close = () => setOpenId(null);
  let detail = null;
  if (chip) {
    const used = team.chipsUsed?.[chip.id];
    const reason = cannotPlayChip(team, chip.id, locks);
    if (chip.id === savedActive) {
      detail = <p className="ok">Playing this week. Chips can't be undone once confirmed.</p>;
    } else if (chip.id === active) {
      detail = (
        <>
          <p className="muted small">Waiting for you to confirm it with your other changes.</p>
          <div className="sheet-actions">
            <button onClick={close}>Close</button>
            <button className="danger" onClick={() => { actions.cancelChip(); close(); }}>Don't play it</button>
          </div>
        </>
      );
    } else if (used != null) {
      detail = <p className="muted">Played in Week {used}.</p>;
    } else if (reason) {
      detail = <p className="muted">{reason}.</p>;
    } else {
      detail = (
        <>
          <p className="muted small">One use a season and one chip a week. You'll review it with your other changes, and once confirmed it can't be undone.</p>
          <div className="sheet-actions">
            <button onClick={close}>Not now</button>
            <button className="primary" onClick={() => { actions.playChip(chip.id); close(); }}>Play {chip.name}</button>
          </div>
        </>
      );
    }
  }

  return (
    <>
      <div className="chip-row">
        {CHIPS.map((c) => {
          const s = statusOf(c.id);
          return (
            <button key={c.id} className={`chip-card ${s.cls}`} onClick={() => setOpenId(c.id)}>
              <span className="chip-name">{c.name}</span>
              <span className="chip-status">{s.text}</span>
            </button>
          );
        })}
      </div>

      {chip && (
        <div className="sheet-backdrop" onClick={close}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3 className="sheet-name">{chip.name}</h3>
            <p>{chip.blurb}</p>
            {detail}
          </div>
        </div>
      )}
    </>
  );
}
