// Rebuild the market at each deadline of a past season from cached Sleeper data
// (see scripts/fetch-season.mjs). Pure: the caller loads the JSON.
//
// Sleeper's archived weekly projections are the final, post-inactives versions. Used raw,
// they'd tell every manager about Sunday's inactives before Thursday's deadline. So we
// model the deadline: a player who also missed his team's previous game is a known,
// ongoing absence (listed Out, projection stays as archived); a fresh absence wasn't known
// yet, so he keeps last week's projection. Backups' archived projections may still reflect
// news a little early, so treat injury windfalls in the replay as slightly understated.

import { RULES } from './rules.js';
import { buildMarket } from './sleeper.js';
import { PRICE_MOVES, capPriceMoves } from './pricing.js';
import { boxScore, scoredTds } from './statLines.js';
import { weekWinners } from './results.js';
import { weekInfo } from './gameweeks.js';

const pts = (stats) => stats?.[RULES.scoring] ?? 0;
const playedSet = (rows = []) => new Set(rows.filter((r) => (r.stats?.gp ?? 0) > 0).map((r) => r.player_id));

/** Season-to-date totals for weeks before `week`, shaped like Sleeper's season stats rows. */
function statsBefore(stats, week) {
  const totals = new Map();
  for (let w = 1; w < week; w++) {
    for (const r of stats[w] ?? []) {
      const s = r.stats ?? {};
      if (!s.gp) continue;
      const t = totals.get(r.player_id) ?? { gp: 0, [RULES.scoring]: 0, off_snp: 0, tm_off_snp: 0 };
      t.gp += s.gp;
      t[RULES.scoring] += pts(s);
      t.off_snp += s.off_snp ?? 0;
      t.tm_off_snp += s.tm_off_snp ?? 0;
      totals.set(r.player_id, t);
    }
  }
  return [...totals].map(([player_id, s]) => ({ player_id, stats: { ...s, tm_off_snp: s.tm_off_snp || undefined } }));
}

/** The last week before `week` in which `team` played, or null. */
function lastGame(weeks, team, week) {
  for (let i = weeks.length - 1; i >= 0; i--) if (weeks[i].week < week && weeks[i].teams.has(team)) return weeks[i].week;
  return null;
}

/**
 * What was known at the deadline: projections with fresh absences hidden, and the set of
 * players known to be out (they also missed their team's previous game).
 */
function deadlineView({ seasonProj, proj, stats }, weeks, week) {
  const played = (w) => playedSet(stats[w]);
  const playedNow = played(week);
  const playedIn = new Map();
  const preseason = new Map(seasonProj.map((r) => [r.player_id, pts(r.stats) / 17]));
  const lastProj = new Map();
  for (let w = 1; w < week; w++) for (const r of proj[w] ?? []) if (pts(r.stats) > 0) lastProj.set(r.player_id, pts(r.stats));

  // Some absent players have no projection row at all, so walk the whole player list.
  const projById = new Map((proj[week] ?? []).map((r) => [r.player_id, r]));
  const knownOut = new Set();
  const projections = [];
  for (const { player_id: id, team, player } of seasonProj) {
    const row = projById.get(id) ?? { player_id: id, team, player, stats: {} };
    if (playedNow.has(id)) {
      projections.push(row);
      continue;
    }
    const prev = lastGame(weeks, team, week);
    if (prev != null) {
      if (!playedIn.has(prev)) playedIn.set(prev, played(prev));
      if (!playedIn.get(prev).has(id)) {
        knownOut.add(id);
        projections.push(row);
        continue;
      }
    }
    const guess = lastProj.get(id) ?? preseason.get(id) ?? 0;
    projections.push(guess > pts(row.stats) ? { ...row, stats: { ...row.stats, [RULES.scoring]: guess } } : row);
  }
  return { projections, knownOut };
}

/** The priced market at the week's deadline, the week's actual scores, and box scores by player. */
export function replayWeek(data, week) {
  const weeks = weekInfo(data.schedule);
  const { projections, knownOut } = deadlineView(data, weeks, week);
  const market = buildMarket({
    seasonProj: data.seasonProj.map((r) => (knownOut.has(r.player_id) ? { ...r, player: { ...r.player, injury_status: 'Out' } } : r)),
    seasonStats: statsBefore(data.stats, week),
    weekProj: projections,
    weeks,
    week,
  });
  const scores = {};
  const box = {};
  const winners = weekWinners(data.schedule, week);
  for (const r of data.stats[week] ?? []) {
    scores[r.player_id] = { pts: pts(r.stats), played: (r.stats?.gp ?? 0) > 0, td: scoredTds(r.stats), team: r.team, won: winners.has(r.team) };
    if (r.stats?.gp) box[r.player_id] = boxScore(r.stats);
  }
  return { market, scores, box, weeks };
}

/**
 * Every week of the season, with prices capped week to week (pass null for uncapped).
 * Returns [{ week, market, byId, scores, box }] indexed from week 1 at [0].
 */
export function replaySeason(data, moves = PRICE_MOVES) {
  const out = [];
  const total = Math.max(...data.schedule.map((g) => g.week));
  for (let week = 1; week <= total; week++) {
    let { market, scores, box } = replayWeek(data, week);
    const prev = out.at(-1);
    if (moves && prev) market = capPriceMoves(market, new Map(prev.market.map((p) => [p.id, p.price])), moves);
    out.push({ week, market, byId: new Map(market.map((p) => [p.id, p])), scores, box });
  }
  return out;
}
