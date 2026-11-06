// Online league: a past season replayed one gameweek per day. Pure, shared by the
// server (which is authoritative) and the browser (for display).

const TIME_ZONE = 'Europe/London';

/** Epoch ms for a wall-clock date and time in the UK, e.g. ('2026-11-10', '20:00'). */
export function ukTime(date, time) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh, mm);
  // Find the UK offset at that moment (GMT or BST) and shift by it.
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(asUtc))
      .map((p) => [p.type, p.value]),
  );
  const shown = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return asUtc - (shown - asUtc);
}

const addDays = (date, n) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/**
 * Deadlines for a league: week 1 at `deadlineTime` (UK) on `startDate`, then one week a
 * day at the same clock time. At each deadline teams lock and the league goes offline
 * for `updateMinutes` while the week is processed. Then the results appear and the next
 * week opens.
 *   locked:   the deadline has passed (no more changes)
 *   complete: the update window is over (results are public)
 */
export function leagueWeeks({ startDate, deadlineTime, weeks, updateMinutes = 0 }, now = Date.now()) {
  return Array.from({ length: weeks }, (_, i) => {
    const deadline = ukTime(addDays(startDate, i), deadlineTime);
    const reopens = deadline + updateMinutes * 60 * 1000;
    return { week: i + 1, deadline, reopens, locked: deadline <= now, complete: reopens <= now };
  });
}

/** The week open for changes, or null once the last deadline has passed. */
export const leagueOpenWeek = (weeks) => weeks.find((w) => !w.locked)?.week ?? null;

/** The week currently being processed (locked, results not yet out), or null. */
export const leagueUpdating = (weeks) => weeks.find((w) => w.locked && !w.complete) ?? null;
