// Online league: the live NFL season. Pure, shared by the server (which is authoritative)
// and the browser (for display).
//
// Each player locks at his team's scheduled kickoff, by the clock, never by game state
// (polling lag would leave a window after kickoff). A week is open from when the previous
// week is processed until its own processing, PROCESS_HOURS after its last kickoff, when
// the final scores are taken and the next week opens with new prices.

export const PROCESS_HOURS = 8;

/**
 * The weeks of the season. schedule: [{ week, home, away, kickoff }] (kickoff in epoch ms).
 * Weeks before startWeek (before the league began) count as done, marked preLeague.
 *   deadline:  the week's first kickoff (chips must be played before it)
 *   processAt: when the week's final scores are taken and the next week opens
 *   locked:    the first game has kicked off
 *   complete:  processed (points are final)
 */
export function leagueWeeks(schedule, startWeek, now = Date.now()) {
  const total = Math.max(0, ...schedule.map((g) => g.week));
  return Array.from({ length: total }, (_, i) => {
    const week = i + 1;
    const kickoffs = schedule.filter((g) => g.week === week && Number.isFinite(g.kickoff)).map((g) => g.kickoff);
    const deadline = kickoffs.length ? Math.min(...kickoffs) : null;
    const processAt = kickoffs.length ? Math.max(...kickoffs) + PROCESS_HOURS * 60 * 60 * 1000 : null;
    const before = week < startWeek;
    return {
      week,
      deadline,
      processAt,
      locked: before || (deadline != null && deadline <= now),
      complete: before || (processAt != null && processAt <= now),
      ...(before && { preLeague: true }),
    };
  });
}

/** The week open for changes, or null once the season is over. */
export const leagueOpenWeek = (weeks) => weeks.find((w) => !w.complete)?.week ?? null;

/**
 * What has locked so far in `week`: { teams: NFL teams whose game has kicked off,
 * chips: true once any game has, next: the next kickoff still to come (or null) }.
 * This is the `locks` the squad functions take.
 */
export function weekLocks(schedule, week, now = Date.now()) {
  const games = schedule.filter((g) => g.week === week);
  const started = games.filter((g) => g.kickoff <= now);
  const upcoming = games.filter((g) => !(g.kickoff <= now)).map((g) => g.kickoff);
  return {
    teams: new Set(started.flatMap((g) => [g.home, g.away])),
    chips: started.length > 0,
    next: upcoming.length ? Math.min(...upcoming) : null,
  };
}

/** Kickoff (epoch ms) of `team`'s game in `week`, or null on a bye. */
export function kickoffOf(schedule, week, team) {
  return schedule.find((g) => g.week === week && (g.home === team || g.away === team))?.kickoff ?? null;
}
