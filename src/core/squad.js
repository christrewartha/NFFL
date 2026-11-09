// Squad, lineup, transfers and gameweek scoring. Pure functions over a plain team
// object so the whole thing serialises straight to storage.
//
// Team shape:
//   starters: id|null per RULES.starterSlots, bench: id|null x benchSize (order = autosub order)
//   buy: { id: price paid }, info: { id: { name, pos, team } } (kept after selling, for history)
//   bank, captain, vice, rolesSet (true once the user picks an armband themselves)
//   currentWeek: the week being edited; createdWeek: the squad-building week (free transfers)
//   ftAtWeekStart: free transfers available this week (null = unlimited, i.e. building week)
//   weekStartIds: squad at the start of this week, to count transfers made
//   weekStart: lineup, prices paid and bank at the start of this week (what a Free Hit returns to)
//   chipsUsed: { [chip id]: week played }
//   history: { [week]: locked snapshot }
//
// Online league locks: functions that take `locks` ({ teams: Set of NFL teams whose game
// this week has kicked off, chips: true once the week's first game has }, from league.js
// weekLocks) refuse anything touching a player whose game has started. Solo play passes none.

import { CHIPS, RULES, chipName, fitsSlot } from './rules.js';
import { sellPrice } from './pricing.js';

export function newTeam(season, week) {
  return {
    season,
    createdWeek: week,
    currentWeek: week,
    starters: RULES.starterSlots.map(() => null),
    bench: Array(RULES.benchSize).fill(null),
    buy: {},
    info: {},
    bank: RULES.budget,
    captain: null,
    vice: null,
    rolesSet: false,
    ftAtWeekStart: null,
    weekStartIds: [],
    weekStart: null,
    chipsUsed: {},
    history: {},
  };
}

export const squadIds = (team) => [...team.starters, ...team.bench].filter(Boolean);
export const isComplete = (team) => squadIds(team).length === RULES.starterSlots.length + RULES.benchSize;
export const isBuildingWeek = (team) => team.ftAtWeekStart == null;

/** Armbands go to starters only, and not to positions excluded from captaincy. */
export const canCaptain = (team, id) =>
  Boolean(id && team.starters.includes(id) && !RULES.noCaptain.includes(team.info[id]?.pos));

export function countBy(team, key) {
  const counts = {};
  for (const id of squadIds(team)) {
    const k = team.info[id][key];
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

export const isFreePosition = (pos) => RULES.freePositions.includes(pos);

/** Has this squad player's game kicked off? His NFL team is the market's (byId), else as bought. */
export const isLocked = (team, id, locks, byId) => Boolean(id && locks?.teams.has(byId?.get(id)?.team ?? team.info[id]?.team));

// --- Chips ---------------------------------------------------------------------

/** The chip played for the week being edited, or null. */
export const activeChip = (team) =>
  Object.keys(team.chipsUsed ?? {}).find((id) => team.chipsUsed[id] === team.currentWeek) ?? null;

/** Building week or Free Hit: transfers are unlimited and free. */
export const transfersUnlimited = (team) => isBuildingWeek(team) || activeChip(team) === 'freeHit';

/** Can this chip be played this week? Returns null if so, otherwise the reason. */
export function cannotPlayChip(team, id, locks) {
  if (!CHIPS.some((c) => c.id === id)) return 'Unknown chip';
  const used = team.chipsUsed?.[id];
  if (used === team.currentWeek) return 'Already played this week';
  if (used != null) return `Played in Week ${used}`;
  const active = activeChip(team);
  if (active) return `You're playing ${chipName(active)} this week (one chip per week)`;
  if (locks?.chips) return "Chips must be played before the week's first kickoff";
  if (id === 'freeHit' && (isBuildingWeek(team) || !team.weekStart)) return 'Transfers are already free this week';
  return null;
}

export function playChip(team, id, locks) {
  const reason = cannotPlayChip(team, id, locks);
  if (reason) throw new Error(reason);
  return { ...team, chipsUsed: { ...team.chipsUsed, [id]: team.currentWeek } };
}

// --- Transfers -----------------------------------------------------------------

/** Players in the squad now who weren't at the start of the week (free positions don't count). */
export function transfersMade(team) {
  if (transfersUnlimited(team)) return 0;
  const start = new Set(team.weekStartIds);
  return squadIds(team).filter((id) => !start.has(id) && !isFreePosition(team.info[id].pos)).length;
}

export function freeTransfersLeft(team) {
  if (transfersUnlimited(team)) return Infinity;
  return Math.max(0, team.ftAtWeekStart - transfersMade(team));
}

export function pendingHits(team) {
  if (transfersUnlimited(team)) return 0;
  return Math.max(0, transfersMade(team) - team.ftAtWeekStart) * RULES.hitCost;
}

/** What the player would fetch if sold now. */
export function sellValue(team, id, currentPrice) {
  return sellPrice(team.buy[id], currentPrice ?? team.buy[id], RULES.keepProfitShare);
}

/** Can this player be bought right now? Returns null if so, otherwise the reason. */
export function cannotAdd(team, player, locks) {
  const ids = squadIds(team);
  if (ids.includes(player.id)) return 'Already in your squad';
  if (locks?.teams.has(player.team)) return 'Locked: his game has kicked off';
  if ((countBy(team, 'pos')[player.pos] ?? 0) >= RULES.squad[player.pos]) return `You have ${RULES.squad[player.pos]} ${player.pos}s`;
  if ((countBy(team, 'team')[player.team] ?? 0) >= RULES.maxPerTeam) return `Max ${RULES.maxPerTeam} from ${player.team}`;
  if (player.price > team.bank) return 'Not enough in the bank';
  return null;
}

/** Cheapest possible cost of filling the squad's empty spots from the market. */
export function minCostToFill(team, players) {
  const counts = countBy(team, 'pos');
  const owned = new Set(squadIds(team));
  let total = 0;
  for (const [pos, quota] of Object.entries(RULES.squad)) {
    const missing = quota - (counts[pos] ?? 0);
    if (missing <= 0) continue;
    const prices = players.filter((p) => p.pos === pos && !owned.has(p.id)).map((p) => p.price).sort((a, b) => a - b);
    total += prices.slice(0, missing).reduce((s, x) => s + x, 0);
  }
  return total;
}

/**
 * Starting lineup from scratch: best projected player for each slot (scarce slots first,
 * FLEX last), everyone else on the bench in projection order.
 */
export function arrange(ids, posOf, scoreOf) {
  const left = [...ids].sort((a, b) => scoreOf(b) - scoreOf(a));
  const order = RULES.starterSlots.map((slot, i) => ({ slot, i })).sort((a, b) => (a.slot === 'FLEX') - (b.slot === 'FLEX'));
  const starters = RULES.starterSlots.map(() => null);
  for (const { slot, i } of order) {
    const k = left.findIndex((id) => fitsSlot(posOf(id), slot));
    if (k >= 0) starters[i] = left.splice(k, 1)[0];
  }
  const bench = Array(RULES.benchSize).fill(null);
  left.slice(0, RULES.benchSize).forEach((id, i) => { bench[i] = id; });
  return { starters, bench };
}

function place(team, id, pos) {
  const starters = [...team.starters];
  const bench = [...team.bench];
  const exact = RULES.starterSlots.findIndex((s, i) => s === pos && !starters[i]);
  const flex = RULES.starterSlots.findIndex((s, i) => s === 'FLEX' && fitsSlot(pos, s) && !starters[i]);
  const spare = bench.indexOf(null);
  if (exact >= 0) starters[exact] = id;
  else if (flex >= 0) starters[flex] = id;
  else if (spare >= 0) bench[spare] = id;
  else return arrange([...squadIds(team), id], (x) => (x === id ? pos : team.info[x].pos), () => 0);
  return { starters, bench };
}

export function addPlayer(team, player, locks) {
  const reason = cannotAdd(team, player, locks);
  if (reason) throw new Error(reason);
  const withInfo = { ...team, info: { ...team.info, [player.id]: { name: player.name, pos: player.pos, team: player.team } } };
  const next = {
    ...withInfo,
    ...place(withInfo, player.id, player.pos),
    buy: { ...team.buy, [player.id]: player.price },
    bank: team.bank - player.price,
  };
  return withArmbands(next);
}

/**
 * Until the user picks their own, armbands go to the two priciest eligible players.
 * After that, only empty armbands are refilled.
 */
function withArmbands(team) {
  const ranked = team.starters.filter((id) => canCaptain(team, id)).sort((a, b) => team.buy[b] - team.buy[a]);
  if (!team.rolesSet) return { ...team, captain: ranked[0] ?? null, vice: ranked[1] ?? null };
  const captain = team.captain ?? ranked.find((id) => id !== team.vice) ?? null;
  const vice = team.vice ?? ranked.find((id) => id !== captain) ?? null;
  return { ...team, captain, vice };
}

export function removePlayer(team, id, currentPrice) {
  const buy = { ...team.buy };
  delete buy[id];
  return withArmbands({
    ...team,
    starters: team.starters.map((x) => (x === id ? null : x)),
    bench: team.bench.map((x) => (x === id ? null : x)),
    buy,
    bank: team.bank + sellValue(team, id, currentPrice),
    captain: team.captain === id ? null : team.captain,
    vice: team.vice === id ? null : team.vice,
  });
}

// Lineup locations: { list: 'starters' | 'bench', index }.
export function locate(team, id) {
  const s = team.starters.indexOf(id);
  if (s >= 0) return { list: 'starters', index: s };
  const b = team.bench.indexOf(id);
  return b >= 0 ? { list: 'bench', index: b } : null;
}

const fitsLoc = (team, id, loc) => !id || loc.list === 'bench' || fitsSlot(team.info[id].pos, RULES.starterSlots[loc.index]);

export function canSwap(team, a, b) {
  if (a.list === b.list && a.index === b.index) return false;
  const idA = team[a.list][a.index];
  const idB = team[b.list][b.index];
  if (!idA && !idB) return false;
  return fitsLoc(team, idA, b) && fitsLoc(team, idB, a);
}

/** Swap two lineup spots. Captain/vice armbands follow the starting spot, not the player. */
export function swap(team, a, b) {
  if (!canSwap(team, a, b)) return team;
  const next = { ...team, starters: [...team.starters], bench: [...team.bench] };
  const idA = team[a.list][a.index];
  const idB = team[b.list][b.index];
  next[a.list][a.index] = idB;
  next[b.list][b.index] = idA;
  for (const role of ['captain', 'vice']) {
    if (next[role] && !next.starters.includes(next[role])) {
      const replacement = next[role] === idA ? idB : idA;
      next[role] = canCaptain(next, replacement) ? replacement : null;
    }
  }
  if (next.captain && next.captain === next.vice) next.vice = null;
  return next;
}

export function setRole(team, id, role) {
  if (!canCaptain(team, id)) return team;
  const other = role === 'captain' ? 'vice' : 'captain';
  return { ...team, rolesSet: true, [role]: id, [other]: team[other] === id ? team[role] : team[other] };
}

/**
 * Apply a set of pending changes in one go: the squad you want (ids) and, optionally,
 * new armbands and a chip to play. The chip goes first (a Free Hit makes the transfers
 * free), then sells, then buys, at the prices in byId. Throws if the chip or any buy is
 * illegal, or (unless `partial`, for a draft mid-transfer) if it would leave a complete
 * squad incomplete. Used for both the draft preview and the server commit, so they agree.
 * A chip once played stays played: leaving it out of a later commit doesn't cancel it.
 * With `locks`, players whose game has kicked off can't be sold, bought or given an
 * armband, and chips can't be played after the first kickoff. An armband can move off a
 * locked player (giving up his points), but never onto one, even by swapping.
 */
export function applyChanges(team, { squad, captain = null, vice = null, chip = null }, byId, { partial = false, locks } = {}) {
  const want = new Set(squad);
  const locked = (t, id) => isLocked(t, id, locks, byId);
  let next = chip && chip !== activeChip(team) ? playChip(team, chip, locks) : team;
  for (const id of squadIds(team)) {
    if (want.has(id)) continue;
    if (locked(team, id)) throw new Error(`${team.info[id].name} is locked: his game has kicked off`);
    next = removePlayer(next, id, byId.get(id)?.price);
  }
  const have = new Set(squadIds(next));
  for (const id of squad) {
    if (have.has(id)) continue;
    const player = byId.get(id);
    if (!player) throw new Error('Player not found');
    next = addPlayer(next, player, locks);
  }
  if (!partial && isComplete(team) && !isComplete(next)) throw new Error('Finish your transfers: the squad needs 15 players');
  for (const [role, id] of [['captain', captain], ['vice', vice]]) {
    if (!id || id === next[role]) continue;
    if (locked(next, id)) throw new Error(`${next.info[id]?.name ?? 'That player'} is locked: his game has kicked off`);
    next = setRole(next, id, role);
  }
  for (const role of ['captain', 'vice']) if (next[role] !== team[role] && locked(next, next[role])) next = { ...next, [role]: null };
  return next;
}

/** What confirming `draft` would change, relative to the saved team `base`. */
export function changeSummary(base, draft) {
  const before = new Set(squadIds(base));
  const after = new Set(squadIds(draft));
  const out = [...before].filter((id) => !after.has(id));
  const added = [...after].filter((id) => !before.has(id));
  const captain = draft.captain !== base.captain;
  const vice = draft.vice !== base.vice;
  const chip = activeChip(draft) !== activeChip(base) ? activeChip(draft) : null;
  return {
    out,
    in: added,
    captain,
    vice,
    chip,
    changed: out.length > 0 || added.length > 0 || captain || vice || Boolean(chip),
    freeBefore: freeTransfersLeft(base),
    freeAfter: freeTransfersLeft(draft),
    hitsAdded: pendingHits(draft) - pendingHits(base),
    bankBefore: base.bank,
    bankAfter: draft.bank,
    complete: isComplete(draft),
    // A complete squad can only be saved complete: finish each transfer first.
    unfinished: isComplete(base) && !isComplete(draft),
  };
}

/** Best lineup by projection; also hands out armbands if missing. */
export function autoLineup(team, scoreOf) {
  const lineup = arrange(squadIds(team), (id) => team.info[id].pos, scoreOf);
  const next = { ...team, ...lineup };
  const ranked = lineup.starters.filter((id) => canCaptain(next, id)).sort((a, b) => scoreOf(b) - scoreOf(a));
  const keep = (id) => (canCaptain(next, id) ? id : null);
  const captain = keep(team.captain) ?? ranked[0] ?? null;
  const vice = keep(team.vice !== captain ? team.vice : null) ?? ranked.find((id) => id !== captain) ?? null;
  return { ...next, captain, vice };
}

/**
 * Bring a saved team in line with the current rules: re-slot it if the lineup shape
 * changed, and drop armbands that are no longer allowed (refilled by projection).
 */
export function normalizeTeam(team, scoreOf) {
  team = refundFreePositions(team);
  const reshaped = team.starters.length !== RULES.starterSlots.length || team.bench.length !== RULES.benchSize;
  const next = reshaped ? { ...team, ...arrange(squadIds(team), (id) => team.info[id].pos, scoreOf) } : team;
  const allowed = (id) => !id || canCaptain(next, id);
  if (!reshaped && allowed(team.captain) && allowed(team.vice)) return team;
  return autoLineup(next, scoreOf);
}

/**
 * Players bought before a position became free were paid for: give the money back, so
 * existing squads get the same spending power as new ones. Safe to run repeatedly.
 */
export function refundFreePositions(team) {
  const owed = squadIds(team).filter((id) => isFreePosition(team.info[id].pos) && team.buy[id] > 0);
  if (!owed.length) return team;
  const buy = { ...team.buy };
  let bank = team.bank;
  for (const id of owed) {
    bank += buy[id];
    buy[id] = 0;
  }
  return { ...team, buy, bank };
}

/**
 * Lock the team for every week whose deadline has passed and move on to `week`.
 * Unused free transfers carry over (capped); the building week leaves none to carry.
 * After a Free Hit week the squad goes back to how it was at the start of that week,
 * and the free transfers it didn't need carry over as normal.
 */
export function rollover(team, week) {
  if (week == null || week <= team.currentWeek) return team;
  const freeHit = activeChip(team) === 'freeHit' && team.weekStart;
  const history = { ...team.history, [team.currentWeek]: weekSnapshot(team) };
  const after = freeHit ? { ...team, ...team.weekStart } : team;
  for (let w = team.currentWeek + 1; w < week; w++) history[w] = { ...lineupOf(after), transfers: 0, hits: 0 };
  const carried = isBuildingWeek(team) ? 0 : freeHit ? team.ftAtWeekStart : freeTransfersLeft(team);
  const ft = Math.min(RULES.maxBankedTransfers, carried + (week - team.currentWeek) * RULES.freeTransfersPerWeek);
  return {
    ...after,
    history,
    currentWeek: week,
    ftAtWeekStart: ft,
    weekStartIds: squadIds(after),
    weekStart: { ...lineupOf(after), buy: { ...after.buy }, bank: after.bank, rolesSet: after.rolesSet },
  };
}

const lineupOf = (team) => ({ starters: [...team.starters], bench: [...team.bench], captain: team.captain, vice: team.vice });

/** What the week being edited is scored on: lineup, armbands, transfer hits and chip. */
export function weekSnapshot(team) {
  const chip = activeChip(team);
  return { ...lineupOf(team), transfers: transfersMade(team), hits: pendingHits(team), ...(chip && { chip }) };
}

/**
 * Score a locked week. scores: { [id]: { pts, played, td, won } } (td: rushing, receiving
 * and defensive TDs; won: played in a win).
 * When final, starters who didn't play are replaced by the first eligible bench player
 * who did (in bench order), and the vice-captain takes the armband if the captain sat out.
 * Rows carry `bonus`, the chip's extra points, which are already included in `pts`.
 */
export function scoreWeek(snapshot, scores, info, { final = false } = {}) {
  const played = (id) => Boolean(id && scores[id]?.played);
  const ptsOf = (id) => (id ? scores[id]?.pts ?? 0 : 0);
  const chip = snapshot.chip ?? null;
  const captainMult = chip === 'tripleCaptain' ? RULES.tripleCaptainMultiplier : RULES.captainMultiplier;
  const bonusOf = (id, mult) => {
    if (!id) return 0;
    if (chip === 'paydirt') return (scores[id]?.td ?? 0) * RULES.paydirtTdPts * mult;
    if (chip === 'eatTheW') return played(id) && scores[id]?.won ? RULES.eatTheWBonus : 0;
    return 0;
  };
  const starters = [...snapshot.starters];
  const bench = [...snapshot.bench];
  const subbedIn = new Set();
  if (final) {
    RULES.starterSlots.forEach((slot, i) => {
      if (played(starters[i])) return;
      const j = bench.findIndex((id) => played(id) && fitsSlot(info[id].pos, slot));
      if (j < 0) return;
      [starters[i], bench[j]] = [bench[j], starters[i]];
      subbedIn.add(starters[i]);
    });
  }
  let captain = starters.includes(snapshot.captain) ? snapshot.captain : null;
  if (final && !played(captain)) captain = starters.includes(snapshot.vice) && played(snapshot.vice) ? snapshot.vice : null;

  const rows = starters.map((id, i) => {
    const mult = id && id === captain ? captainMult : 1;
    const bonus = bonusOf(id, mult);
    return { slot: RULES.starterSlots[i], id, pts: ptsOf(id) * mult + bonus, mult, bonus, played: played(id), subbedIn: subbedIn.has(id) };
  });
  const benchRows = bench.map((id) => ({ slot: 'BN', id, pts: ptsOf(id), mult: 1, bonus: 0, played: played(id), subbedIn: false }));
  const gross = rows.reduce((s, r) => s + r.pts, 0);
  const chipPts = chip === 'tripleCaptain'
    ? rows.filter((r) => r.mult > 1).reduce((s, r) => s + ptsOf(r.id) * (r.mult - RULES.captainMultiplier), 0)
    : rows.reduce((s, r) => s + r.bonus, 0);
  return { rows, benchRows, gross, chip, chipPts, hits: snapshot.hits ?? 0, total: gross - (snapshot.hits ?? 0) };
}
