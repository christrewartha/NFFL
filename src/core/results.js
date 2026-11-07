// Final scores, from ESPN's public scoreboard. Unofficial but stable and needs no key,
// but it refuses browser requests from other sites, so browsers go through the server.
// Sleeper's schedule has no scores, and rebuilding them from defensive "points allowed"
// misses defensive and special-teams scores.

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
// ESPN team codes that differ from Sleeper's.
const TEAM_ALIASES = { WSH: 'WAS' };
const team = (code) => TEAM_ALIASES[code] ?? code;

/** Finished games from one ESPN scoreboard response: [{ home, away, homeScore, awayScore }]. */
export function parseScoreboard(json) {
  return (json?.events ?? [])
    .map((e) => e.competitions?.[0])
    .filter((c) => c?.status?.type?.completed)
    .map((c) => {
      const side = (s) => c.competitors.find((x) => x.homeAway === s);
      return {
        home: team(side('home').team.abbreviation),
        away: team(side('away').team.abbreviation),
        homeScore: Number(side('home').score),
        awayScore: Number(side('away').score),
      };
    });
}

/** From ESPN directly. Works from Node; browsers should use the league server's /api/nfl-results. */
export async function fetchWeekResults(season, week, { fetchFn = globalThis.fetch.bind(globalThis) } = {}) {
  const res = await fetchFn(`${ESPN}?dates=${season}&seasontype=2&week=${week}`);
  if (!res.ok) throw new Error(`ESPN scoreboard week ${week} failed (${res.status})`);
  return parseScoreboard(await res.json());
}

/** The schedule with final scores filled in. results: [{ week, home, away, homeScore, awayScore }]. */
export function withResults(schedule, results) {
  const byGame = new Map(results.map((r) => [`${r.week}:${r.home}:${r.away}`, r]));
  return schedule.map((g) => {
    const r = byGame.get(`${g.week}:${g.home}:${g.away}`);
    return r ? { ...g, homeScore: r.homeScore, awayScore: r.awayScore } : g;
  });
}

/** Teams that won their game in `week`, from a schedule with final scores. */
export function weekWinners(schedule, week) {
  const winners = new Set();
  for (const g of schedule) {
    if (g.week !== week || g.homeScore == null || g.awayScore == null) continue;
    if (g.homeScore > g.awayScore) winners.add(g.home);
    else if (g.awayScore > g.homeScore) winners.add(g.away);
  }
  return winners;
}

/** Mark each player's score with whether his team won. scores: { [id]: { team, ... } }. */
export function withWins(scores, winners) {
  const out = {};
  for (const [id, s] of Object.entries(scores)) out[id] = { ...s, won: winners.has(s.team) };
  return out;
}
