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
  const row = (id, pts, gp) => ({ player_id: id, team: 'A', player: { first_name: id, last_name: 'X', position: 'WR' }, stats: { [RULES.scoring]: pts, ...(gp != null && { gp }) } });
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

test('league weeks: first kickoff locks the week, processing the morning after the last game opens the next', async () => {
  const { leagueWeeks, leagueOpenWeek } = await import('./league.js');
  const at = (iso) => Date.parse(iso);
  const schedule = [
    { week: 9, home: 'A', away: 'B', kickoff: at('2026-11-06T01:15Z') },
    { week: 10, home: 'NYG', away: 'WAS', kickoff: at('2026-11-13T01:15Z') },
    { week: 10, home: 'DET', away: 'NE', kickoff: at('2026-11-15T18:00Z') },
    { week: 10, home: 'BAL', away: 'LAC', kickoff: at('2026-11-17T01:15Z') },
    { week: 11, home: 'A', away: 'B', kickoff: at('2026-11-20T01:15Z') },
  ];
  let weeks = leagueWeeks(schedule, 10, at('2026-11-10T12:00Z'));
  assert.deepEqual(weeks.slice(8).map((w) => [w.locked, w.complete]), [[true, true], [false, false], [false, false]]);
  assert.equal(weeks[8].preLeague, true); // before the league began
  assert.equal(leagueOpenWeek(weeks), 10);
  assert.equal(new Date(weeks[9].deadline).toISOString(), '2026-11-13T01:15:00.000Z');
  assert.equal(new Date(weeks[9].processAt).toISOString(), '2026-11-17T09:15:00.000Z');
  weeks = leagueWeeks(schedule, 10, at('2026-11-16T12:00Z'));
  assert.deepEqual([weeks[9].locked, weeks[9].complete, leagueOpenWeek(weeks)], [true, false, 10]);
  weeks = leagueWeeks(schedule, 10, at('2026-11-17T09:15Z'));
  assert.deepEqual([weeks[9].complete, leagueOpenWeek(weeks)], [true, 11]);
});

test('weekLocks: teams lock at their scheduled kickoff', async () => {
  const { weekLocks, kickoffOf } = await import('./league.js');
  const schedule = [
    { week: 10, home: 'NYG', away: 'WAS', kickoff: 100 },
    { week: 10, home: 'DET', away: 'NE', kickoff: 200 },
    { week: 11, home: 'KC', away: 'DEN', kickoff: 50 },
  ];
  const before = weekLocks(schedule, 10, 99);
  assert.deepEqual([[...before.teams], before.chips, before.next], [[], false, 100]);
  const thursday = weekLocks(schedule, 10, 100);
  assert.deepEqual([[...thursday.teams].sort(), thursday.chips, thursday.next], [['NYG', 'WAS'], true, 200]);
  assert.equal(weekLocks(schedule, 10, 500).next, null);
  assert.deepEqual([kickoffOf(schedule, 10, 'NE'), kickoffOf(schedule, 10, 'KC')], [200, null]);
});

test('rolling locks: locked players cannot be sold, bought or given an armband', async () => {
  const { applyChanges, cannotAdd, cannotPlayChip, isLocked } = await import('./squad.js');
  let { team, players } = fullSquad();
  team = rollover(team, 10);
  const byId = new Map(players.map((p) => [p.id, p]));
  const ids = squadIds(team);
  const captain = team.captain;
  const capTeam = team.info[captain].team;
  const locks = { teams: new Set([capTeam]), chips: true };
  assert.equal(isLocked(team, captain, locks, byId), true);

  // Selling a locked player.
  const fresh = mk(team.info[captain].pos, 45, 'ZZZ');
  byId.set(fresh.id, fresh);
  assert.throws(() => applyChanges(team, { squad: [...ids.filter((id) => id !== captain), fresh.id] }, byId, { locks }), /locked/);
  // Buying a locked player.
  const lockedBuy = mk('WR', 45, capTeam);
  byId.set(lockedBuy.id, lockedBuy);
  assert.match(cannotAdd(team, lockedBuy, locks), /Locked/);
  // Chips close at the first kickoff.
  assert.match(cannotPlayChip(team, 'paydirt', locks), /first kickoff/);
  assert.throws(() => applyChanges(team, { squad: ids, chip: 'paydirt' }, byId, { locks }), /first kickoff/);

  // The armband can move off a locked captain to an unlocked player...
  const other = ids.find((id) => id !== captain && id !== team.vice && team.info[id].pos !== 'QB' && team.info[id].team !== capTeam);
  const moved = applyChanges(team, { squad: ids, captain: other }, byId, { locks });
  assert.equal(moved.captain, other);
  // ...but never onto a locked one, even by swapping captain and vice.
  assert.throws(() => applyChanges(moved, { squad: ids, captain }, byId, { locks }), /locked/);
  const swapped = applyChanges(team, { squad: ids, captain: team.vice }, byId, { locks });
  assert.equal(swapped.captain, team.vice);
  assert.equal(swapped.vice, null); // the locked old captain doesn't become vice
  // Changing captain after the vice has kicked off gives up the vice (the inactive-captain
  // trick: pass the armband to someone who won't play so it falls back to a vice who scored).
  const viceLocks = { teams: new Set([team.info[team.vice].team]), chips: true };
  const dropped = applyChanges(team, { squad: ids, captain: other }, byId, { locks: viceLocks });
  assert.deepEqual([dropped.captain, dropped.vice], [other, null]);
  // An unchanged captain keeps the locked vice, and a vice still to play survives a switch.
  assert.equal(applyChanges(team, { squad: ids }, byId, { locks: viceLocks }).vice, team.vice);
  assert.equal(moved.vice, team.vice);
  // Without locks (solo play) nothing changes.
  assert.equal(applyChanges(team, { squad: ids, captain: team.vice }, byId).vice, captain);
});

test('parseGames: kickoff times, status, and scores only once final', async () => {
  const { parseGames } = await import('./results.js');
  const game = (state, completed, date) => ({
    date,
    competitions: [{ date, status: { type: { state, completed } }, competitors: [
      { homeAway: 'home', team: { abbreviation: 'NYG' }, score: '17' },
      { homeAway: 'away', team: { abbreviation: 'WSH' }, score: '14' },
    ] }],
  });
  const games = parseGames({ events: [game('pre', false, '2026-11-13T01:15Z'), game('in', false, '2026-11-15T18:00Z'), game('post', true, '2026-11-16T01:20Z')] }, 10);
  assert.deepEqual(games.map((g) => g.status), ['pre_game', 'in_game', 'complete']);
  assert.equal(games[0].kickoff, Date.parse('2026-11-13T01:15Z'));
  assert.equal(games[0].away, 'WAS');
  assert.deepEqual([games[1].homeScore, games[2].homeScore, games[2].week], [undefined, 17, 10]);
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

test('chips: once a season, one a week, not in the building week for Free Hit', async () => {
  const { cannotPlayChip, playChip, activeChip, applyChanges, changeSummary } = await import('./squad.js');
  let { team, players } = fullSquad();
  assert.match(cannotPlayChip(team, 'freeHit'), /already free/);
  assert.equal(cannotPlayChip(team, 'paydirt'), null);
  team = rollover(team, 10);
  const byId = new Map(players.map((p) => [p.id, p]));
  const draft = applyChanges(team, { squad: squadIds(team), chip: 'paydirt' }, byId);
  assert.equal(activeChip(draft), 'paydirt');
  assert.equal(changeSummary(team, draft).chip, 'paydirt');
  assert.match(cannotPlayChip(draft, 'eatTheW'), /one chip per week/);
  // A later commit without the chip doesn't cancel it.
  assert.equal(activeChip(applyChanges(draft, { squad: squadIds(draft) }, byId)), 'paydirt');
  team = rollover(draft, 11);
  assert.equal(team.history[10].chip, 'paydirt');
  assert.match(cannotPlayChip(team, 'paydirt'), /Played in Week 10/);
  assert.throws(() => playChip(team, 'nope'), /Unknown chip/);
});

test('Free Hit: free transfers for a week, then the squad and bank go back', async () => {
  const { playChip } = await import('./squad.js');
  let { team } = fullSquad();
  team = rollover(team, 10);
  const before = { ids: squadIds(team), bank: team.bank, ft: team.ftAtWeekStart };
  team = playChip(team, 'freeHit');
  for (const pos of ['RB', 'WR', 'TE', 'QB']) team = addPlayer(removePlayer(team, team.starters[slotOf(team, pos)], 60), mk(pos, 40));
  assert.equal(pendingHits(team), 0);
  assert.equal(freeTransfersLeft(team), Infinity);
  const fhSquad = squadIds(team);
  team = rollover(team, 11);
  assert.deepEqual(team.history[10].starters.filter(Boolean).sort(), [...fhSquad].sort());
  assert.equal(team.history[10].hits, 0);
  assert.deepEqual(squadIds(team).sort(), [...before.ids].sort());
  assert.equal(team.bank, before.bank);
  assert.equal(team.ftAtWeekStart, Math.min(RULES.maxBankedTransfers, before.ft + RULES.freeTransfersPerWeek));
  assert.equal(transfersMade(team), 0);
});

test('scoreWeek chips: Triple Captain, Paydirt and Eat the W', () => {
  const info = { a: { pos: 'RB' }, b: { pos: 'WR' }, c: { pos: 'WR' } };
  const starters = RULES.starterSlots.map(() => null);
  starters[2] = 'a';
  starters[6] = 'b';
  starters[7] = 'c';
  const base = { starters, bench: [], captain: 'a', vice: 'b', hits: 0 };
  const scores = {
    a: { pts: 20, played: true, td: 2, won: true },
    b: { pts: 10, played: true, td: 1, won: false },
    c: { pts: 0, played: false, td: 0, won: true },
  };
  const plain = scoreWeek(base, scores, info, { final: true });
  assert.equal(plain.gross, 50);

  const tc = scoreWeek({ ...base, chip: 'tripleCaptain' }, scores, info, { final: true });
  assert.equal(tc.gross, 70);
  assert.equal(tc.chipPts, 20);

  const paydirt = scoreWeek({ ...base, chip: 'paydirt' }, scores, info, { final: true });
  // The captain's TDs are doubled by the armband as well.
  assert.equal(paydirt.chipPts, 2 * RULES.paydirtTdPts * 2 + RULES.paydirtTdPts);
  assert.equal(paydirt.gross, 50 + paydirt.chipPts);

  const w = scoreWeek({ ...base, chip: 'eatTheW' }, scores, info, { final: true });
  assert.equal(w.chipPts, RULES.eatTheWBonus); // c's team won but he didn't play
});
