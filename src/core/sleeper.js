// Sleeper data source. Public, no auth, CORS-enabled.
// Note: only /v1/state is documented; the projections/stats/schedule endpoints
// are the ones sleeper.com itself uses and could change without notice.

import { POSITIONS, RULES } from './rules.js';
import { adjustForInjury, assignPrices, expectedPpg, isOut } from './pricing.js';
import { isBye, openWeek, weekInfo } from './gameweeks.js';
import { boxScore, scoredTds } from './statLines.js';

const API = 'https://api.sleeper.app';
const CDN = 'https://sleepercdn.com';
const SEASON_GAMES = 17;
// Skill players below this expected ppg are left out of the market (practice squad, etc.).
const MIN_VALUE = 1;

export function headshotUrl(player) {
  if (!player?.id) return null;
  if (player.pos === 'DEF') return teamLogoUrl(player.team);
  return `${CDN}/content/nfl/players/thumb/${player.id}.jpg`;
}

export function teamLogoUrl(team) {
  return team ? `${CDN}/images/team_logos/nfl/${team.toLowerCase()}.png` : null;
}

const pts = (stats) => stats?.[RULES.scoring] ?? null;

/**
 * Turn raw Sleeper responses into the priced player market.
 * seasonProj / seasonStats / weekProj: arrays from /projections|stats/nfl/{season}[/{week}].
 */
export function buildMarket({ seasonProj, seasonStats = [], weekProj = [], weeks = [], week = null }) {
  const statsById = new Map(seasonStats.map((r) => [r.player_id, r.stats]));
  const weekById = new Map(weekProj.map((r) => [r.player_id, r]));

  const players = [];
  for (const r of seasonProj) {
    const p = r.player;
    if (!p || !POSITIONS.includes(p.position) || !r.team) continue;
    const st = statsById.get(r.player_id);
    const wk = weekById.get(r.player_id);
    const gp = st?.gp ?? 0;
    const seasonPts = pts(st);
    const projPts = pts(r.stats);
    const bye = isBye(weeks, week, r.team);
    const rawWeek = bye ? null : pts(wk?.stats) ?? 0;
    const player = {
      id: r.player_id,
      name: `${p.first_name} ${p.last_name}`.trim(),
      pos: p.position,
      team: r.team,
      injury: p.injury_status ? { status: p.injury_status, part: p.injury_body_part ?? null } : null,
      gp,
      seasonPts: seasonPts ?? 0,
      seasonPpg: gp > 0 && seasonPts != null ? seasonPts / gp : null,
      projPpg: projPts != null ? projPts / SEASON_GAMES : null,
      weekProj: adjustForInjury(rawWeek, p.injury_status),
      opponent: bye ? 'BYE' : wk?.opponent ?? null,
      snapPct: st?.tm_off_snp ? Math.round((100 * (st.off_snp ?? 0)) / st.tm_off_snp) : null,
    };
    // Price on quality: a player who's out keeps his form-based value until he's back.
    player.value = expectedPpg({ ...player, weekProj: isOut(p.injury_status) ? null : rawWeek });
    if (player.value < MIN_VALUE && !['K', 'DEF'].includes(player.pos)) continue;
    players.push(player);
  }
  return assignPrices(players).sort((a, b) => b.price - a.price || b.value - a.value);
}

async function getJson(fetchFn, path) {
  const res = await fetchFn(`${API}${path}`);
  if (!res.ok) throw new Error(`Sleeper ${path} failed (${res.status})`);
  return res.json();
}

const positionQuery = POSITIONS.map((p) => `position[]=${p}`).join('&');

/** Fetch everything needed for the market and gameweek clock. */
export async function fetchMarket({ fetchFn = globalThis.fetch.bind(globalThis), now = Date.now() } = {}) {
  const state = await getJson(fetchFn, '/v1/state/nfl');
  const season = Number(state.league_season || state.season);
  const schedule = await getJson(fetchFn, `/schedule/nfl/regular/${season}`);
  const weeks = weekInfo(schedule);
  const week = openWeek(weeks, now);
  const players = await marketFor(fetchFn, season, weeks, week);
  return { players, schedule, season, week, syncedAt: Date.now() };
}

/** The NFL season Sleeper is on now, e.g. 2026. */
export async function fetchCurrentSeason({ fetchFn = globalThis.fetch.bind(globalThis) } = {}) {
  const state = await getJson(fetchFn, '/v1/state/nfl');
  return Number(state.league_season || state.season);
}

/** The market for one week of a season, priced from what Sleeper knows now (no price caps). */
export async function fetchWeekMarket(season, week, { fetchFn = globalThis.fetch.bind(globalThis) } = {}) {
  const schedule = await getJson(fetchFn, `/schedule/nfl/regular/${season}`);
  return marketFor(fetchFn, season, weekInfo(schedule), week);
}

async function marketFor(fetchFn, season, weeks, week) {
  const [seasonProj, seasonStats, weekProj] = await Promise.all([
    getJson(fetchFn, `/projections/nfl/${season}?season_type=regular&${positionQuery}`),
    getJson(fetchFn, `/stats/nfl/${season}?season_type=regular&${positionQuery}`).catch(() => []),
    week ? getJson(fetchFn, `/projections/nfl/${season}/${week}?season_type=regular&${positionQuery}`) : [],
  ]);
  const players = buildMarket({ seasonProj, seasonStats, weekProj, weeks, week });
  if (players.length < 100) throw new Error('Sleeper returned too few players.');
  return players;
}

/** One week's stats, keyed by player id: { [id]: { pts, played, td, team } }. Add `won` with withWins(). */
export async function fetchWeekScores(season, week, { fetchFn = globalThis.fetch.bind(globalThis) } = {}) {
  const rows = await getJson(fetchFn, `/stats/nfl/${season}/${week}?season_type=regular&${positionQuery}`);
  const out = {};
  for (const r of rows) out[r.player_id] = { pts: pts(r.stats) ?? 0, played: (r.stats?.gp ?? 0) > 0, td: scoredTds(r.stats), team: r.team };
  return out;
}

/** One player's game log for a season: [{ week, pts, played, stats }], weeks he has stats for. */
export async function fetchPlayerLog(season, id, { fetchFn = globalThis.fetch.bind(globalThis) } = {}) {
  const data = await getJson(fetchFn, `/stats/nfl/player/${id}?season_type=regular&season=${season}&grouping=week`);
  return Object.values(data ?? {})
    .filter((r) => r?.stats)
    .map((r) => ({ week: Number(r.week), pts: pts(r.stats) ?? 0, played: (r.stats.gp ?? 0) > 0, stats: boxScore(r.stats) }))
    .sort((a, b) => a.week - b.week);
}
