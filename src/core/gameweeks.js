// Gameweeks from the Sleeper schedule: deadlines, byes, which week is open for changes.
// The schedule only has dates, not kickoff times, so the deadline is a conservative
// 12:00 UTC on the date of the week's first game (before any NFL kickoff, incl. London).

const DEADLINE_HOUR_UTC = 12;

export function weekInfo(schedule) {
  const weeks = new Map();
  for (const g of schedule) {
    if (!weeks.has(g.week)) weeks.set(g.week, { week: g.week, firstDate: g.date, teams: new Set(), games: [] });
    const w = weeks.get(g.week);
    if (g.date < w.firstDate) w.firstDate = g.date;
    w.teams.add(g.home);
    w.teams.add(g.away);
    w.games.push(g);
  }
  return [...weeks.values()]
    .sort((a, b) => a.week - b.week)
    .map((w) => {
      const [y, m, d] = w.firstDate.split('-').map(Number);
      return {
        week: w.week,
        deadline: Date.UTC(y, m - 1, d, DEADLINE_HOUR_UTC),
        teams: w.teams,
        complete: w.games.every((g) => g.status === 'complete'),
      };
    });
}

/** The first week whose deadline hasn't passed, or null once the season is over. */
export function openWeek(weeks, now = Date.now()) {
  return weeks.find((w) => w.deadline > now)?.week ?? null;
}

export function isBye(weeks, week, team) {
  const w = weeks.find((x) => x.week === week);
  return Boolean(w && team && !w.teams.has(team));
}

export function isWeekComplete(weeks, week) {
  return Boolean(weeks.find((x) => x.week === week)?.complete);
}

/**
 * A team's season week by week: { week, opponent, home, status, score } or { week, bye: true }.
 * status is Sleeper's game status ('pre_game', 'in_game', 'complete') when the schedule has it;
 * score is { for, against } once the schedule carries the final score (see results.js).
 */
export function teamFixtures(schedule, team) {
  const total = Math.max(0, ...schedule.map((g) => g.week));
  const games = new Map();
  for (const g of schedule) {
    const final = g.homeScore != null && g.awayScore != null;
    if (g.home === team) games.set(g.week, { opponent: g.away, home: true, status: g.status, score: final ? { for: g.homeScore, against: g.awayScore } : null });
    else if (g.away === team) games.set(g.week, { opponent: g.home, home: false, status: g.status, score: final ? { for: g.awayScore, against: g.homeScore } : null });
  }
  return Array.from({ length: total }, (_, i) => ({ week: i + 1, ...(games.get(i + 1) ?? { bye: true }) }));
}

export const fixtureLabel = (f) => (!f ? '' : f.bye ? 'BYE' : `${f.home ? 'v' : '@'} ${f.opponent}`);

/** "W 44–21", "L 17–20" or "T 20–20" from the team's point of view, or '' before the final. */
export function fixtureResult(f) {
  if (!f?.score) return '';
  const { for: us, against: them } = f.score;
  return `${us > them ? 'W' : us < them ? 'L' : 'T'} ${us}–${them}`;
}
