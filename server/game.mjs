// League game logic on the server: the live NFL season. Keeps the calendar (kickoff times
// from ESPN), each week's prices and live scores (from Sleeper), and every team rolled
// over. Uses the same core code as the browser.
//
// The weekly cycle (times from league.js):
//   week opens       prices are set and stored; projections and injuries refresh every
//                    few hours until the first kickoff, without moving prices
//   each kickoff     that game's players lock (enforced by applyChanges with weekLocks)
//   games on         Sleeper is polled every couple of minutes for live points
//   processing       final scores are stored, every team rolls over, the next week opens

import { fetchWeekGames, weekWinners, withWins } from '../src/core/results.js';
import { fetchCurrentSeason, fetchWeekMarket, fetchWeekScores } from '../src/core/sleeper.js';
import { leagueOpenWeek, leagueWeeks } from '../src/core/league.js';
import { capPriceMoves } from '../src/core/pricing.js';
import { newTeam, refundFreePositions, rollover, scoreWeek, weekSnapshot } from '../src/core/squad.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const LIVE_POLL = 2 * MINUTE;
const CALENDAR_REFRESH = 12 * HOUR;
const MARKET_REFRESH = 3 * HOUR;
// A game counts as on from kickoff until ESPN says it's over (or this long, if it never does).
const GAME_LENGTH = 5 * HOUR;
const REGULAR_WEEKS = 18;

export function createGame(store, { now = () => Date.now(), log = console.log } = {}) {
  let season = Number(store.setting('season')) || null;
  let startWeek = Number(store.setting('startWeek')) || null;
  let games = [];
  let calendarAt = 0;
  const lastPoll = new Map();
  const cache = new Map();

  // Parsed copies of stored markets and scores, re-read only when the row changes.
  function cached(key, stamp, read) {
    if (!stamp) return null;
    const hit = cache.get(key);
    if (hit?.updatedAt === stamp.updated_at) return hit.value;
    const value = read();
    cache.set(key, { updatedAt: stamp.updated_at, value });
    return value;
  }

  function market(week) {
    return cached(`m${week}`, store.marketStamp(season, week), () => {
      const m = store.market(season, week);
      return { ...m, byId: new Map(m.players.map((p) => [p.id, p])) };
    });
  }

  function scores(week) {
    return cached(`s${week}`, store.scoresStamp(season, week), () => store.scores(season, week));
  }

  const clock = (t = now()) => {
    const weeks = leagueWeeks(games, startWeek, t);
    const open = leagueOpenWeek(weeks);
    return { weeks, open, rolloverTo: open ?? weeks.length + 1 };
  };

  // --- Calendar ------------------------------------------------------------------
  async function refreshCalendar(weeks) {
    const fresh = await Promise.all(weeks.map((w) => fetchWeekGames(season, w)));
    const replaced = new Set(weeks.filter((_, i) => fresh[i].length));
    games = [...games.filter((g) => !replaced.has(g.week)), ...fresh.flat()].sort((a, b) => a.week - b.week || a.kickoff - b.kickoff);
    store.saveCalendar(season, games);
  }

  async function refreshAllWeeks() {
    const from = startWeek ?? 1;
    await refreshCalendar(Array.from({ length: REGULAR_WEEKS - from + 1 }, (_, i) => from + i));
    calendarAt = now();
  }

  // --- Prices ----------------------------------------------------------------------
  // A week's prices are set once, capped against the previous week's. Until the previous
  // week is processed they're provisional, and set again (once) when it is.
  async function priceWeek(week, c) {
    const players = await fetchWeekMarket(season, week);
    const prev = market(week - 1);
    const priced = prev ? capPriceMoves(players, new Map(prev.players.map((p) => [p.id, p.price]))) : players;
    const provisional = c.weeks[week - 2]?.processAt > now();
    store.saveMarket(season, week, priced, { provisional });
    log(`Week ${week} prices set${provisional ? ' (provisional until last week is processed)' : ''}: ${priced.length} players`);
  }

  // New projections and injury news, at the prices already set. Players new to the market
  // come in at their computed price.
  async function refreshProjections(week) {
    const stored = market(week);
    const priceOf = new Map(stored.players.map((p) => [p.id, p.price]));
    const players = (await fetchWeekMarket(season, week)).map((p) => (priceOf.has(p.id) ? { ...p, price: priceOf.get(p.id) } : p));
    store.saveMarket(season, week, players, { provisional: stored.provisional });
  }

  // --- Scores ------------------------------------------------------------------------
  async function updateScores(week, { final = false } = {}) {
    const raw = await fetchWeekScores(season, week);
    store.saveScores(season, week, withWins(raw, weekWinners(games, week)), { final });
  }

  // --- Teams -------------------------------------------------------------------------
  /** A team brought up to date with the clock (new teams start in the open week). */
  function currentTeam(team, c) {
    return rollover(refundFreePositions(team ?? newTeam(season, c.rolloverTo)), c.rolloverTo);
  }

  /** Load an account's team, up to date, saving it if the clock moved it on. */
  function teamOf(accountId, c, saved = store.team(accountId, season)) {
    const team = currentTeam(saved, c);
    if (JSON.stringify(team) !== JSON.stringify(saved)) store.saveTeam(accountId, season, team);
    return team;
  }

  function rollAll(c) {
    const all = store.teams(season);
    for (const t of all) teamOf(t.accountId, c, t.team);
    return all.length;
  }

  /** Points for each processed week: [{ week, total, ...scoreWeek }]. */
  function results(team, c) {
    return Object.keys(team.history ?? {})
      .map(Number)
      .filter((week) => c.weeks[week - 1]?.complete && week >= startWeek)
      .sort((a, b) => a - b)
      .map((week) => ({ week, ...scoreWeek(team.history[week], scores(week)?.scores ?? {}, team.info, { final: true }) }));
  }

  /** Provisional points for the open week once its first game has kicked off, else null. */
  function liveResult(team, c) {
    if (!c.open || !c.weeks[c.open - 1].locked || team.currentWeek !== c.open) return null;
    return { week: c.open, ...scoreWeek(weekSnapshot(team), scores(c.open)?.scores ?? {}, team.info) };
  }

  // --- The loop ----------------------------------------------------------------------
  async function init() {
    if (!season) {
      season = await fetchCurrentSeason();
      store.setSetting('season', season);
    }
    const saved = store.calendar(season);
    if (saved) {
      games = saved.games;
      calendarAt = saved.updatedAt;
    }
    if (!games.length || now() - calendarAt > CALENDAR_REFRESH) await refreshAllWeeks();
    if (!startWeek) {
      // The league starts with the first week that hasn't kicked off yet.
      startWeek = leagueWeeks(games, 1, now()).find((w) => !w.locked)?.week ?? REGULAR_WEEKS;
      store.setSetting('startWeek', startWeek);
      log(`League started: ${season} season from Week ${startWeek}`);
    }
  }

  let started = false;
  let busy = false;
  async function tick() {
    if (busy) return;
    busy = true;
    try {
      if (!started) {
        await init();
        started = true;
      }
      const t = now();
      if (t - calendarAt > CALENDAR_REFRESH) await refreshAllWeeks();

      // Live points: poll while any game of a week in play is on, and once more after each
      // game ends (or if there are no scores yet, after a restart).
      let c = clock(t);
      for (const w of c.weeks.filter((x) => x.week >= startWeek && x.locked && !x.complete)) {
        const started = games.filter((g) => g.week === w.week && g.kickoff <= t);
        const on = started.some((g) => t < g.kickoff + GAME_LENGTH && g.status !== 'complete');
        const lastEnd = Math.max(0, ...started.map((g) => g.kickoff + GAME_LENGTH).filter((end) => end <= t));
        const stored = scores(w.week);
        const due = on || !stored || stored.updatedAt < lastEnd;
        if (!due || t - (lastPoll.get(w.week) ?? 0) < LIVE_POLL) continue;
        lastPoll.set(w.week, t);
        await refreshCalendar([w.week]);
        await updateScores(w.week);
      }

      // Processing: final scores for finished weeks, then everyone moves on.
      for (const w of c.weeks.filter((x) => x.week >= startWeek && x.complete)) {
        if (scores(w.week)?.final) continue;
        await refreshCalendar([w.week]);
        await updateScores(w.week, { final: true });
        log(`Week ${w.week} processed: final scores in, ${rollAll(c)} team(s) rolled over`);
      }

      // The open week's prices.
      c = clock(now());
      if (c.open) {
        const m = market(c.open);
        const before = !c.weeks[c.open - 1].locked;
        const prevDone = !(c.weeks[c.open - 2]?.processAt > now());
        if (!m || (m.provisional && prevDone && before)) await priceWeek(c.open, c);
        else if (before && now() - m.updatedAt > MARKET_REFRESH) await refreshProjections(c.open);
      }
    } catch (e) {
      console.error('League update failed (will retry):', e);
    } finally {
      busy = false;
    }
  }

  return {
    get season() { return season; },
    get startWeek() { return startWeek; },
    /** True once the season, calendar and the open week's prices are in. */
    isReady: () => started && (!clock().open || Boolean(market(clock().open))),
    tick,
    clock,
    schedule: () => games,
    market,
    scores,
    teamOf,
    results,
    liveResult,
  };
}
