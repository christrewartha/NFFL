// Final scores, from ESPN's public scoreboard. Unofficial but stable and needs no key,
// but it refuses browser requests from other sites, so browsers go through the server.
// Sleeper's schedule has no scores, and rebuilding them from defensive "points allowed"
// misses defensive and special-teams scores.

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
// ESPN team codes that differ from Sleeper's.
const TEAM_ALIASES = { WSH: 'WAS' };
const team = (code) => TEAM_ALIASES[code] ?? code;

/**
 * Every game in one ESPN scoreboard response: [{ week, home, away, kickoff, status,
 * homeScore?, awayScore? }]. kickoff is epoch ms; status is 'pre_game', 'in_game' or
 * 'complete' (Sleeper's words). Scores are only filled in once the game is final.
 */
export function parseGames(json, week) {
  return (json?.events ?? []).flatMap((e) => {
    const c = e.competitions?.[0];
    if (!c) return [];
    const side = (s) => c.competitors.find((x) => x.homeAway === s);
    const done = Boolean(c.status?.type?.completed);
    return [{
      week,
      home: team(side('home').team.abbreviation),
      away: team(side('away').team.abbreviation),
      kickoff: Date.parse(c.date ?? e.date),
      status: done ? 'complete' : c.status?.type?.state === 'in' ? 'in_game' : 'pre_game',
      ...(done && { homeScore: Number(side('home').score), awayScore: Number(side('away').score) }),
    }];
  });
}

/** Finished games from one ESPN scoreboard response: [{ home, away, homeScore, awayScore }]. */
export function parseScoreboard(json) {
  return parseGames(json)
    .filter((g) => g.status === 'complete')
    .map(({ home, away, homeScore, awayScore }) => ({ home, away, homeScore, awayScore }));
}

async function fetchScoreboard(season, week, fetchFn) {
  const res = await fetchFn(`${ESPN}?dates=${season}&seasontype=2&week=${week}`);
  if (!res.ok) throw new Error(`ESPN scoreboard week ${week} failed (${res.status})`);
  return res.json();
}

/** From ESPN directly. Works from Node; browsers should use the league server's /api/nfl-results. */
export async function fetchWeekResults(season, week, { fetchFn = globalThis.fetch.bind(globalThis) } = {}) {
  return parseScoreboard(await fetchScoreboard(season, week, fetchFn));
}

/** One week's games with kickoff times and status (see parseGames). Node only, as above. */
export async function fetchWeekGames(season, week, { fetchFn = globalThis.fetch.bind(globalThis) } = {}) {
  return parseGames(await fetchScoreboard(season, week, fetchFn), week);
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
