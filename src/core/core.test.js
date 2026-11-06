import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from './rules.js';
import { assignPrices, expectedPpg, sellPrice } from './pricing.js';
import { isBye, openWeek, weekInfo } from './gameweeks.js';
import {
  addPlayer, autoLineup, canSwap, cannotAdd, freeTransfersLeft, isComplete, newTeam, squadIds,
  minCostToFill, normalizeTeam, pendingHits, removePlayer, rollover, scoreWeek, setRole, swap, transfersMade,
} from './squad.js';

let n = 0;
const mk = (pos, price = 45, team = `T${n % 30}`) => ({ id: `p${++n}`, name: `P${n}`, pos, team, price });

// The original FPL-style lineup with a bench and FLEX. Not the current rules, but the
// engine still supports it, so the bench mechanics stay tested.
const BENCH_RULES = {
  starterSlots: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'K', 'DEF'],
  benchSize: 6,
  noCaptain: [],
};

function withRules(overrides, fn) {
  const saved = { ...RULES };
  Object.assign(RULES, overrides);
  try {
    return fn();
  } finally {
    Object.assign(RULES, saved);
  }
}

const slotOf = (team, pos) => team.starters.findIndex((id) => team.info[id].pos === pos);

function fullSquad() {
  let team = newTeam(2026, 9);
  const players = [];
  for (const [pos, count] of Object.entries(RULES.squad)) {
    for (let i = 0; i < count; i++) players.push(mk(pos, 50));
  }
  for (const p of players) team = addPlayer(team, p);
  return { team, players };
}

test('expectedPpg shrinks form towards projection and blends next week', () => {
  assert.equal(expectedPpg({ seasonPpg: null, projPpg: 10, weekProj: null }), 10);
  assert.equal(expectedPpg({ seasonPpg: 20, gp: 3, projPpg: 10, weekProj: null }), 15);
  assert.equal(expectedPpg({ seasonPpg: 10, gp: 3, projPpg: 10, weekProj: 20 }), 14);
});

test('assignPrices maps value onto the position band', () => {
  const players = Array.from({ length: 30 }, (_, i) => ({ id: `${i}`, pos: 'TE', value: 30 - i }));
  const priced = assignPrices(players);
  assert.equal(priced[0].price, 90); // above the second-best is capped
  assert.equal(priced[1].price, 90);
  assert.equal(priced[19].price, 40); // replacement level
  assert.equal(priced[29].price, 40);
  assert.ok(priced[10].price > 40 && priced[10].price < 90);
});

test('sellPrice keeps half the profit, rounded down', () => {
  assert.equal(sellPrice(50, 55), 52);
  assert.equal(sellPrice(50, 45), 45);
  assert.equal(sellPrice(50, 51), 50);
});

test('gameweeks: deadlines, open week, byes', () => {
  const schedule = [
    { week: 1, date: '2026-09-10', home: 'A', away: 'B', status: 'complete' },
    { week: 1, date: '2026-09-13', home: 'C', away: 'D', status: 'complete' },
    { week: 2, date: '2026-09-17', home: 'A', away: 'C', status: 'pre_game' },
  ];
  const weeks = weekInfo(schedule);
  assert.equal(openWeek(weeks, Date.UTC(2026, 8, 10, 11)), 1);
  assert.equal(openWeek(weeks, Date.UTC(2026, 8, 10, 13)), 2);
  assert.equal(openWeek(weeks, Date.UTC(2026, 8, 20)), null);
  assert.equal(isBye(weeks, 2, 'B'), true);
  assert.equal(isBye(weeks, 2, 'A'), false);
  assert.equal(weeks[0].complete, true);
});

test('building a squad respects quotas, team limit and budget', () => {
  const { team } = fullSquad();
  assert.ok(isComplete(team));
  assert.equal(team.bank, RULES.budget - 15 * 50);
  assert.ok(team.captain && team.vice && team.captain !== team.vice);
  assert.equal(cannotAdd(team, mk('QB')), 'You have 2 QBs');

  let t = newTeam(2026, 9);
  for (let i = 0; i < 3; i++) t = addPlayer(t, mk('WR', 45, 'KC'));
  assert.match(cannotAdd(t, mk('RB', 45, 'KC')), /Max 3/);
  assert.match(cannotAdd(t, mk('RB', 2000, 'SF')), /bank/);
});

test('players fill exact slot, then FLEX, then bench', () => withRules(BENCH_RULES, () => {
  let t = newTeam(2026, 9);
  const rbs = [mk('RB'), mk('RB'), mk('RB'), mk('RB')];
  for (const p of rbs) t = addPlayer(t, p);
  assert.deepEqual(t.starters.slice(1, 3), [rbs[0].id, rbs[1].id]);
  assert.equal(t.starters[RULES.starterSlots.indexOf('FLEX')], rbs[2].id);
  assert.equal(t.bench[0], rbs[3].id);
}));

test('with no bench, every squad member starts', () => {
  const { team } = fullSquad();
  assert.equal(team.bench.length, 0);
  assert.equal(team.starters.filter(Boolean).length, 15);
});

test('armbands follow price until the user picks, then stick', () => {
  let t = newTeam(2026, 9);
  const k = mk('K', 40);
  const star = mk('WR', 120);
  const mid = mk('RB', 80);
  t = addPlayer(addPlayer(addPlayer(t, k), star), mid);
  assert.equal(t.captain, star.id);
  assert.equal(t.vice, mid.id);
  t = setRole(t, k.id, 'captain');
  t = addPlayer(t, mk('WR', 125));
  assert.equal(t.captain, k.id);
  t = removePlayer(t, k.id, 40);
  assert.ok(t.captain && t.captain !== t.vice); // emptied armband is refilled
});

test('QBs cannot wear an armband', () => {
  let t = newTeam(2026, 9);
  const qb = mk('QB');
  const rb = mk('RB');
  t = addPlayer(addPlayer(t, qb), rb);
  assert.equal(t.captain, rb.id);
  assert.equal(setRole(t, qb.id, 'vice').vice, null);
  assert.equal(autoLineup(t, (id) => (id === qb.id ? 99 : 1)).captain, rb.id);
});

test('normalizeTeam re-slots a bench-era team and strips a QB captain', () => {
  const old = withRules(BENCH_RULES, () => {
    const { team } = fullSquad();
    return { ...team, captain: team.starters[0] };
  });
  assert.equal(old.bench.length, 6);
  const t = normalizeTeam(old, () => 0);
  assert.equal(t.starters.length, 15);
  assert.equal(t.starters.filter(Boolean).length, 15);
  assert.notEqual(t.info[t.captain].pos, 'QB');
});

test('transfers: building week is free, then free transfers then hits', () => {
  let { team } = fullSquad();
  const transfer = (t, pos) => addPlayer(removePlayer(t, t.starters[slotOf(t, pos)], 50), mk(pos, 50));
  team = transfer(team, 'RB');
  assert.equal(pendingHits(team), 0);

  team = rollover(team, 10);
  assert.equal(team.history[9].hits, 0);
  const ft = RULES.freeTransfersPerWeek;
  assert.equal(freeTransfersLeft(team), ft);

  const positions = ['RB', 'WR', 'TE', 'QB', 'K'];
  for (let i = 0; i < ft; i++) team = transfer(team, positions[i]);
  assert.equal(transfersMade(team), ft);
  assert.equal(pendingHits(team), 0);
  team = transfer(team, positions[ft]);
  assert.equal(pendingHits(team), RULES.hitCost);

  team = rollover(team, 12);
  assert.equal(team.history[10].hits, RULES.hitCost);
  assert.equal(team.history[11].hits, 0);
  assert.equal(team.ftAtWeekStart, Math.min(RULES.maxBankedTransfers, 2 * ft));
});

test('buying back a player sold this week is not a transfer', () => {
  let { team, players } = fullSquad();
  team = rollover(team, 10);
  const out = team.starters[0];
  team = removePlayer(team, out, 50);
  team = addPlayer(team, players.find((p) => p.id === out));
  assert.equal(transfersMade(team), 0);
});

test('free transfers bank up to the cap', () => {
  let { team } = fullSquad();
  team = rollover(team, 10);
  team = rollover(team, 30);
  assert.equal(team.ftAtWeekStart, RULES.maxBankedTransfers);
});

test('swaps respect slot eligibility and move the armband', () => withRules(BENCH_RULES, () => {
  let { team } = fullSquad();
  team = autoLineup(team, () => 0);
  const qbBench = { list: 'bench', index: team.bench.findIndex((id) => team.info[id].pos === 'QB') };
  const qbStart = { list: 'starters', index: 0 };
  const rbStart = { list: 'starters', index: 1 };
  assert.equal(canSwap(team, qbBench, rbStart), false);
  assert.equal(canSwap(team, qbBench, qbStart), true);
  team = { ...team, captain: team.starters[0] };
  const benchQb = team.bench[qbBench.index];
  team = swap(team, qbBench, qbStart);
  assert.equal(team.captain, benchQb);
}));

test('scoreWeek: autosubs, captain and vice', () => withRules(BENCH_RULES, () => {
  const info = { a: { pos: 'QB' }, b: { pos: 'RB' }, c: { pos: 'QB' }, d: { pos: 'WR' } };
  const snapshot = {
    starters: ['a', 'b', null, null, null, null, null, null, null],
    bench: ['d', 'c', null, null, null, null],
    captain: 'a',
    vice: 'b',
    hits: 4,
  };
  const scores = { a: { pts: 0, played: false }, b: { pts: 10, played: true }, c: { pts: 7, played: true }, d: { pts: 5, played: true } };
  const live = scoreWeek(snapshot, scores, info);
  assert.equal(live.gross, 10);

  const final = scoreWeek(snapshot, scores, info, { final: true });
  // c replaces a at QB (d can't play QB), b gets the armband, d fills an empty WR slot.
  assert.equal(final.rows[0].id, 'c');
  assert.ok(final.rows[0].subbedIn);
  assert.equal(final.rows[1].pts, 20);
  assert.equal(final.rows[3].id, 'd');
  assert.equal(final.gross, 7 + 20 + 5);
  assert.equal(final.total, 28);
}));

test('minCostToFill sums the cheapest players for each empty spot', () => {
  let t = newTeam(2026, 9);
  t = addPlayer(t, mk('K', 50));
  const market = [mk('K', 40), mk('DEF', 42), mk('DEF', 41), ...Array.from({ length: 20 }, () => mk('WR', 45))];
  // K is filled; positions with no one in this market add nothing.
  assert.equal(minCostToFill(t, market), 41 + 5 * 45);
});

test('replay hides fresh absences at the deadline but not ongoing ones', async () => {
  const { replayWeek } = await import('./replay.js');
  const row = (id, pts, gp) => ({ player_id: id, team: 'A', player: { first_name: id, last_name: 'X', position: 'WR' }, stats: { pts_half_ppr: pts, ...(gp != null && { gp }) } });
  const data = {
    schedule: [1, 2, 3].map((week) => ({ week, date: `2025-09-0${week}`, home: 'A', away: 'B', status: 'complete' })),
    seasonProj: [row('fresh', 170), row('ongoing', 170)],
    proj: { 2: [row('fresh', 12), row('ongoing', 12)], 3: [row('fresh', 0), row('ongoing', 0)] },
    stats: { 1: [], 2: [row('fresh', 10, 1)], 3: [] },
  };
  const { market } = replayWeek(data, 3);
  const byId = Object.fromEntries(market.map((p) => [p.id, p]));
  assert.equal(byId.fresh.weekProj, 12); // played week 2, so week 3's absence wasn't known yet
  assert.equal(byId.ongoing.weekProj, 0); // already missing in week 2
});

test('capPriceMoves limits rises and falls separately', async () => {
  const { capPriceMoves } = await import('./pricing.js');
  const prev = new Map([['a', 50], ['b', 100]]);
  const capped = capPriceMoves([{ id: 'a', price: 110 }, { id: 'b', price: 50 }, { id: 'c', price: 70 }], prev, { maxRise: 3, maxFall: 1 });
  assert.deepEqual(capped.map((p) => p.price), [53, 99, 70]);
});

test('league clock: daily UK deadlines across the clocks going back', async () => {
  const { leagueWeeks, leagueOpenWeek, ukTime } = await import('./league.js');
  assert.equal(new Date(ukTime('2026-07-01', '20:00')).toISOString(), '2026-07-01T19:00:00.000Z'); // BST
  assert.equal(new Date(ukTime('2026-12-01', '20:00')).toISOString(), '2026-12-01T20:00:00.000Z'); // GMT
  const weeks = leagueWeeks({ startDate: '2026-10-24', deadlineTime: '20:00', weeks: 3 }, ukTime('2026-10-25', '21:00'));
  assert.deepEqual(weeks.map((w) => new Date(w.deadline).toISOString()), ['2026-10-24T19:00:00.000Z', '2026-10-25T20:00:00.000Z', '2026-10-26T20:00:00.000Z']);
  assert.deepEqual(weeks.map((w) => w.complete), [true, true, false]);
  assert.equal(leagueOpenWeek(weeks), 3);
});

test('league clock: offline for the update window after each deadline', async () => {
  const { leagueWeeks, leagueOpenWeek, leagueUpdating, ukTime } = await import('./league.js');
  const at = (time) => leagueWeeks({ startDate: '2026-11-10', deadlineTime: '22:00', weeks: 3, updateMinutes: 60 }, ukTime('2026-11-11', time));
  // 21:59 on day 2: week 1 is done, week 2 still open.
  let weeks = at('21:59');
  assert.deepEqual([leagueOpenWeek(weeks), leagueUpdating(weeks)?.week ?? null], [2, null]);
  // 22:30: week 2 locked and being processed; its results aren't out yet.
  weeks = at('22:30');
  assert.equal(leagueUpdating(weeks).week, 2);
  assert.equal(weeks[1].complete, false);
  assert.equal(new Date(leagueUpdating(weeks).reopens).toISOString(), '2026-11-11T23:00:00.000Z');
  // 23:00: results out, week 3 open.
  weeks = at('23:00');
  assert.deepEqual([leagueOpenWeek(weeks), leagueUpdating(weeks), weeks[1].complete], [3, null, true]);
});

test('applyChanges: sells then buys, keeps buy price on a buy-back, and refuses half transfers', async () => {
  const { applyChanges, changeSummary, squadIds } = await import('./squad.js');
  let { team, players } = fullSquad();
  team = rollover(team, 10);
  const byId = new Map(players.map((p) => [p.id, { ...p, price: 60 }])); // everyone has risen
  const ids = squadIds(team);
  const out = ids.find((id) => team.info[id].pos === 'WR');
  const fresh = mk('WR', 45);
  byId.set(fresh.id, fresh);

  const draft = applyChanges(team, { squad: [...ids.filter((id) => id !== out), fresh.id] }, byId);
  const s = changeSummary(team, draft);
  assert.deepEqual([s.out, s.in], [[out], [fresh.id]]);
  assert.equal(s.bankAfter - s.bankBefore, 55 - 45); // sold for 50 + half of the 10 rise, bought at 45
  assert.equal(s.freeBefore - s.freeAfter, 1);
  assert.equal(s.hitsAdded, 0);

  assert.equal(changeSummary(team, applyChanges(team, { squad: ids }, byId)).changed, false);
  const half = { squad: ids.filter((id) => id !== out) };
  assert.throws(() => applyChanges(team, half, byId), /15 players/);
  assert.equal(changeSummary(team, applyChanges(team, half, byId, { partial: true })).unfinished, true);
  const rb = ids.find((id) => team.info[id].pos === 'RB' && id !== team.captain && id !== team.vice);
  assert.equal(changeSummary(team, applyChanges(team, { squad: ids, captain: rb }, byId)).captain, true);
});

test('teamFixtures: home/away by week, gaps are byes', async () => {
  const { teamFixtures, fixtureLabel } = await import('./gameweeks.js');
  const schedule = [
    { week: 1, home: 'KC', away: 'BUF', status: 'complete' },
    { week: 3, home: 'DEN', away: 'KC' },
    { week: 3, home: 'BUF', away: 'MIA' },
  ];
  const kc = teamFixtures(schedule, 'KC');
  assert.deepEqual(kc.map(fixtureLabel), ['v BUF', 'BYE', '@ DEN']);
  assert.equal(teamFixtures(schedule, 'BUF')[1].bye, true);
  assert.equal(kc[0].status, 'complete');
});

test('kickers and defences are free and swapping them is not a transfer', async () => {
  const { refundFreePositions } = await import('./squad.js');
  const priced = assignPrices([...Array.from({ length: 20 }, (_, i) => ({ id: `k${i}`, pos: 'K', value: 20 - i })), { id: 'd', pos: 'DEF', value: 9 }]);
  assert.ok(priced.every((p) => p.price === 0));

  let { team } = fullSquad();
  team = rollover(team, 10);
  const k = squadIds(team).find((id) => team.info[id].pos === 'K');
  const def = squadIds(team).find((id) => team.info[id].pos === 'DEF');
  team = addPlayer(removePlayer(team, k, 0), mk('K', 0));
  team = addPlayer(removePlayer(team, def, 0), mk('DEF', 0));
  assert.equal(transfersMade(team), 0);
  assert.equal(freeTransfersLeft(team), RULES.freeTransfersPerWeek);
  team = addPlayer(removePlayer(team, team.starters[slotOf(team, 'WR')], 50), mk('WR', 50));
  assert.equal(transfersMade(team), 1); // only the WR counts

  // Squads that paid for a K/DEF before they became free get the money back, once.
  const old = fullSquad().team; // fullSquad bought K and DEF at 50 each
  const refunded = refundFreePositions(old);
  assert.equal(refunded.bank, old.bank + 100);
  assert.equal(refundFreePositions(refunded), refunded);
});

test('statLine: readable box scores per position', async () => {
  const { statLine, sumBox } = await import('./statLines.js');
  assert.equal(statLine('QB', { pass_cmp: 30, pass_att: 39, pass_yd: 360, pass_td: 5, rush_att: 3, rush_yd: 5 }), '30/39, 360 yds, 5 TD · 3 rush, 5 yds');
  assert.equal(statLine('RB', { rush_att: 18, rush_yd: 164, rush_td: 1, rec: 6, rec_tgt: 7, rec_yd: 30, fum_lost: 1 }), '18 rush, 164 yds, 1 TD · 6/7 rec, 30 yds · 1 fumble lost');
  assert.equal(statLine('WR', { rec: 9, rec_tgt: 11, rec_yd: 184, rec_td: 2 }), '9/11 rec, 184 yds, 2 TD');
  assert.equal(statLine('K', { fgm: 4, fga: 5, xpm: 2, xpa: 2 }), 'FG 4/5, XP 2/2');
  assert.equal(statLine('DEF', { sack: 1, int: 4, pts_allow: 20 }), '1 sack, 4 INT, 20 pts allowed');
  assert.equal(statLine('DEF', sumBox([{ sack: 3, pts_allow: 20 }, { sack: 2, pts_allow: 14 }]), { games: 2 }), '5 sacks, 17.0 pts allowed/gm');
  assert.equal(statLine('WR', {}), '');
});

test('final scores: ESPN scoreboard to W/L lines, with team codes translated', async () => {
  const { parseScoreboard, withResults } = await import('./results.js');
  const { teamFixtures, fixtureResult } = await import('./gameweeks.js');
  const game = (home, hs, away, as, completed = true) => ({
    competitions: [{ status: { type: { completed } }, competitors: [
      { homeAway: 'home', team: { abbreviation: home }, score: String(hs) },
      { homeAway: 'away', team: { abbreviation: away }, score: String(as) },
    ] }],
  });
  const parsed = parseScoreboard({ events: [game('CIN', 20, 'PIT', 23), game('WSH', 28, 'JAX', 22), game('KC', 0, 'DEN', 0, false)] });
  assert.deepEqual(parsed.map((g) => `${g.away}@${g.home}`), ['PIT@CIN', 'JAX@WAS']); // unfinished game skipped

  const schedule = withResults([{ week: 1, home: 'CIN', away: 'PIT' }, { week: 2, home: 'PIT', away: 'NE' }], parsed.map((r) => ({ week: 1, ...r })));
  const pit = teamFixtures(schedule, 'PIT');
  assert.equal(fixtureResult(pit[0]), 'W 23–20');
  assert.equal(fixtureResult(teamFixtures(schedule, 'CIN')[0]), 'L 20–23');
  assert.equal(fixtureResult(pit[1]), ''); // not played yet
});

test('league schedule hides scores until that week\'s results are out', async () => {
  const { leagueSchedule } = await import('../../server/game.mjs');
  const schedule = [{ week: 1, home: 'A', away: 'B', homeScore: 10, awayScore: 7 }, { week: 2, home: 'B', away: 'A', homeScore: 3, awayScore: 21 }];
  const c = { weeks: [{ week: 1, complete: true }, { week: 2, complete: false }] };
  const seen = leagueSchedule(schedule, c);
  assert.equal(seen[0].homeScore, 10);
  assert.equal(seen[1].homeScore, undefined);
  assert.equal(seen[1].awayScore, undefined);
});
