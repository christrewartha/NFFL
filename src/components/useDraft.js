import { useEffect, useMemo, useRef, useState } from 'react';
import { applyChanges, changeSummary, setRole, squadIds } from '../core/squad.js';

/**
 * Local tinkering on top of the saved team. Changes are held as an intent (the squad
 * you want plus armbands and a chip) and previewed with the same applyChanges the server uses.
 * Nothing is saved until confirm() hands the intent to `commit`. `locks` (online league)
 * are the players whose game has kicked off; see squad.js.
 */
export function useDraft(base, byId, commit, locks) {
  const [intent, setIntent] = useState(null);
  const [notice, setNotice] = useState(null);
  const committing = useRef(false);
  const intentRef = useRef(intent);
  intentRef.current = intent;
  const baseKey = base ? JSON.stringify(base) : null;

  // A new saved team (our commit, or the deadline rolling over) replaces the draft.
  useEffect(() => {
    if (!committing.current && intentRef.current) setNotice('The week moved on, so your unconfirmed changes were discarded.');
    committing.current = false;
    setIntent(null);
  }, [baseKey]);

  const draft = useMemo(() => {
    if (!intent || !base) return base;
    try {
      return applyChanges(base, intent, byId, { partial: true, locks });
    } catch {
      return base;
    }
  }, [intent, base, byId, locks]);

  const summary = base && draft ? changeSummary(base, draft) : null;
  const edit = (fn) => {
    setNotice(null);
    setIntent((i) => fn(i ?? { squad: squadIds(base), captain: null, vice: null, chip: null }));
  };

  const actions = {
    buy: (p) => edit((i) => ({ ...i, squad: [...i.squad, p.id] })),
    sell: (p) => edit((i) => ({ ...i, squad: i.squad.filter((id) => id !== p.id) })),
    setRole: (id, role) => edit((i) => {
      const t = setRole(draft, id, role);
      return { ...i, captain: t.captain, vice: t.vice };
    }),
    // Only an unconfirmed chip can be cancelled: once saved it stays played.
    playChip: (id) => edit((i) => ({ ...i, chip: id })),
    cancelChip: () => edit((i) => ({ ...i, chip: null })),
  };

  return {
    base,
    byId,
    draft,
    summary,
    actions,
    notice,
    discard: () => setIntent(null),
    confirm: async () => {
      committing.current = true;
      try {
        await commit(intent, draft);
      } catch (e) {
        committing.current = false;
        throw e;
      }
    },
  };
}
