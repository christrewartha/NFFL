import { useState } from 'react';
import { RULES, chipName, fmtPrice } from '../core/rules.js';
import { activeChip, isFreePosition, sellValue } from '../core/squad.js';
import { playerFor, priceText } from './lookup.js';

const freeText = (n, team) => (n === Infinity ? `unlimited (${activeChip(team) === 'freeHit' ? 'Free Hit' : 'squad-building week'})` : String(n));

/** Pending-changes bar above the tabs, and the confirmation sheet behind it. */
export function DraftBar({ draftState }) {
  const { base, byId, draft, summary, discard, confirm } = draftState;
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  if (!summary?.changed) return null;

  const free = (id) => isFreePosition(draft.info[id]?.pos);
  const count = (ids, wantFree) => ids.filter((id) => free(id) === wantFree).length;
  const transfers = Math.max(count(summary.out, false), count(summary.in, false));
  const freeSwaps = Math.max(count(summary.out, true), count(summary.in, true));
  const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
  const headline = [summary.chip && chipName(summary.chip), transfers && plural(transfers, 'transfer'), freeSwaps && plural(freeSwaps, 'free K/DEF swap')].filter(Boolean).join(' + ') || 'Armband change';
  const freeUsed = summary.freeAfter === Infinity ? 0 : summary.freeBefore - summary.freeAfter;
  const name = (id) => (playerFor(id, draft, byId) ?? playerFor(id, base, byId))?.name ?? id;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await confirm();
      setReviewing(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="draft-bar">
        <div className="draft-text">
          <strong>{headline}</strong>
          <span className="muted small">
            {summary.hitsAdded > 0 ? <span className="error">−{summary.hitsAdded} pts</span> : 'No points cost'}
            {' · '}bank {fmtPrice(summary.bankAfter)}
          </span>
        </div>
        <button onClick={discard}>Undo all</button>
        <button className="primary" onClick={() => setReviewing(true)}>Review</button>
      </div>

      {reviewing && (
        <div className="sheet-backdrop" onClick={() => !busy && setReviewing(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3 className="sheet-name">Confirm changes</h3>
            {summary.out.length + summary.in.length > 0 && (
              <table className="week-table confirm-table">
                <tbody>
                  {summary.out.map((id) => (
                    <tr key={`o${id}`}><td className="error">Out</td><td>{name(id)}</td><td className="num">{free(id) ? 'Free' : fmtPrice(sellValue(base, id, byId.get(id)?.price))}</td></tr>
                  ))}
                  {summary.in.map((id) => (
                    <tr key={`i${id}`}><td className="ok">In</td><td>{name(id)}</td><td className="num">{priceText(draft.buy[id], draft.info[id]?.pos)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
            <dl className="sheet-stats">
              {summary.chip && <div><dt>Chip</dt><dd><strong>{chipName(summary.chip)}</strong></dd></div>}
              <div><dt>Free transfers used</dt><dd>{freeUsed} (left: {freeText(summary.freeAfter, draft)})</dd></div>
              <div><dt>Points cost</dt><dd className={summary.hitsAdded ? 'error' : ''}>{summary.hitsAdded ? `−${summary.hitsAdded} (${RULES.hitCost} per extra transfer)` : 'None'}</dd></div>
              <div><dt>Bank</dt><dd>{fmtPrice(summary.bankBefore)} → {fmtPrice(summary.bankAfter)}</dd></div>
              {(summary.captain || summary.vice) && (
                <div><dt>Armbands</dt><dd>{summary.captain && `C: ${name(draft.captain)}`}{summary.captain && summary.vice && ', '}{summary.vice && `V: ${draft.vice ? name(draft.vice) : 'none'}`}</dd></div>
              )}
            </dl>
            {base.vice && !draft.vice && summary.captain && (
              <p className="chip-warning">You'll have no vice-captain. Changing captain after your vice has kicked off gives him up, and a player whose game has started can't take the armband. You can pick a new vice from players still to play.</p>
            )}
            {summary.chip && <p className="chip-warning">Once confirmed, {chipName(summary.chip)} can't be undone. It's used for Week {draft.currentWeek} whatever happens.</p>}
            {summary.unfinished ? (
              <p className="error">Pick a replacement for everyone you've sold before confirming.</p>
            ) : (
              !summary.complete && <p className="muted small">Your squad isn't complete yet. You can save it now and finish later.</p>
            )}
            {error && <p className="error">{error}</p>}
            <div className="sheet-actions">
              <button onClick={() => setReviewing(false)} disabled={busy}>Keep editing</button>
              <button className="primary" onClick={submit} disabled={busy || summary.unfinished}>{busy ? 'Saving…' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
