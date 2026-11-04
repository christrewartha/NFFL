// Replay a past season with a population of simulated managers, under several rule
// variants, to see which strategies win and how much luck matters.
// Usage: node scripts/replay.mjs [season] [--managers N]   (run fetch-season.mjs first)
// Writes reports/replay-{season}.md and .json.

import { mkdir, writeFile } from 'node:fs/promises';
import { loadSeason } from './load-season.mjs';
import { replaySeason } from '../src/core/replay.js';
import { RULES, fmtPrice } from '../src/core/rules.js';
import { PRICE_MOVES } from '../src/core/pricing.js';
import {
  addPlayer, autoLineup, canCaptain, freeTransfersLeft, newTeam, removePlayer,
  rollover, scoreWeek, sellValue, setRole, squadIds,
} from '../src/core/squad.js';

const season = Number(process.argv[2]?.startsWith('--') ? 2025 : process.argv[2] ?? 2025);
const MANAGERS = Number(process.argv[process.argv.indexOf('--managers') + 1]) || 400;

// --- Manager model -----------------------------------------------------------
// Every manager values players the same way (this week's projection plus a few weeks
// of expected ppg) but with personal taste noise, so squads differ. Styles:
//   passive: picks a squad and never transfers
//   active:  makes the best transfers each week, takes a hit only for a big gain
//   stash:   active, but also holds the backups of their two priciest RBs and never sells them
const HORIZON = 3;
const TASTE_SD = 0.15;
const FREE_GAIN = 2;
const HIT_GAIN = RULES.hitCost + 6;
const MAX_MOVES = 4;
const STYLES = [['active', 0.45], ['stash', 0.45], ['passive', 0.1]];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeManager(i) {
  const rand = rng(1000 + i);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
  const taste = new Map();
  const u = (i + 0.5) / MANAGERS;
  let acc = 0;
  const style = STYLES.find(([, share]) => (acc += share) >= u)?.[0] ?? 'active';
  return {
    id: i,
    style,
    tasteOf: (id) => {
      if (!taste.has(id)) taste.set(id, Math.max(0.5, 1 + TASTE_SD * gauss()));
      return taste.get(id);
    },
    protect: new Set(),
    team: null,
    weekly: [],
    stashPts: 0,
  };
}

const score = (m, p) => (p ? m.tasteOf(p.id) * ((p.weekProj ?? 0) + HORIZON * p.value) : 0);

/** Best single same-position swap. `rank` decides what "best" means. */
function bestSwap(m, byId, players, rank) {
  const team = m.team;
  const ids = squadIds(team);
  const owned = new Set(ids);
  const teamCount = {};
  for (const id of ids) teamCount[team.info[id].team] = (teamCount[team.info[id].team] ?? 0) + 1;
  let best = null;
  for (const outId of ids) {
    if (m.protect.has(outId)) continue;
    const out = byId.get(outId);
    const outInfo = team.info[outId];
    const budget = team.bank + sellValue(team, outId, out?.price);
    const outScore = score(m, out);
    for (const p of players) {
      if (p.pos !== outInfo.pos || owned.has(p.id) || p.price > budget) continue;
      if ((teamCount[p.team] ?? 0) - (outInfo.team === p.team ? 1 : 0) >= RULES.maxPerTeam) continue;
      const gain = score(m, p) - outScore;
      if (gain <= 0) continue;
      const r = rank(gain, p.price - (budget - team.bank));
      if (!best || r > best.r) best = { r, gain, outId, out, p };
    }
  }
  return best;
}

const doSwap = (team, s) => addPlayer(removePlayer(team, s.outId, s.out?.price), s.p);

function buildSquad(m, market, byId) {
  let team = newTeam(season, 1);
  // Start from the cheapest legal squad, then upgrade by best gain per £.
  for (const pos of Object.keys(RULES.squad)) {
    const cheap = market.filter((p) => p.pos === pos).sort((a, b) => a.price - b.price || score(m, b) - score(m, a));
    for (const p of cheap) {
      if (squadIds(team).filter((id) => team.info[id].pos === pos).length >= RULES.squad[pos]) break;
      try { team = addPlayer(team, p); } catch { /* team limit; try the next one */ }
    }
  }
  m.team = team;
  const upgrade = () => {
    for (let s; (s = bestSwap(m, byId, market, (gain, cost) => gain / Math.max(1, cost))); ) m.team = doSwap(m.team, s);
  };
  upgrade();
  if (m.style === 'stash') {
    const rbs = squadIds(m.team).map((id) => byId.get(id)).filter((p) => p.pos === 'RB').sort((a, b) => b.price - a.price);
    for (const starter of rbs.slice(0, 2)) {
      const backup = market
        .filter((p) => p.pos === 'RB' && p.team === starter.team && p.id !== starter.id && !squadIds(m.team).includes(p.id))
        .sort((a, b) => (b.projPpg ?? 0) - (a.projPpg ?? 0))[0];
      const out = squadIds(m.team).map((id) => byId.get(id))
        .filter((p) => p.pos === 'RB' && !m.protect.has(p.id) && !rbs.slice(0, 2).includes(p))
        .sort((a, b) => score(m, a) - score(m, b))[0];
      if (!backup || !out) continue;
      try {
        m.team = addPlayer(removePlayer(m.team, out.id, out.price), backup);
        m.protect.add(backup.id);
      } catch { /* can't afford or team limit: skip this handcuff */ }
    }
    upgrade();
  }
}

function weeklyMoves(m, byId, market) {
  if (m.style === 'passive') return;
  for (let k = 0; k < MAX_MOVES; k++) {
    const s = bestSwap(m, byId, market, (gain) => gain);
    if (!s || s.gain < (freeTransfersLeft(m.team) > 0 ? FREE_GAIN : HIT_GAIN)) break;
    m.team = doSwap(m.team, s);
  }
}

function pickArmbands(m, byId) {
  const proj = (id) => byId.get(id)?.weekProj ?? 0;
  if (RULES.benchSize > 0) m.team = autoLineup(m.team, proj);
  const ranked = m.team.starters.filter((id) => canCaptain(m.team, id)).sort((a, b) => m.tasteOf(b) * proj(b) - m.tasteOf(a) * proj(a));
  if (ranked[0]) m.team = setRole(m.team, ranked[0], 'captain');
  if (ranked[1]) m.team = setRole(m.team, ranked[1], 'vice');
}

function teamValue(team, byId) {
  return squadIds(team).reduce((s, id) => s + sellValue(team, id, byId.get(id)?.price), team.bank);
}

function runVariant(weeksData) {
  const managers = Array.from({ length: MANAGERS }, (_, i) => makeManager(i));
  for (let w = 1; w <= weeksData.length; w++) {
    const { market, byId, scores } = weeksData[w - 1];
    for (const m of managers) {
      if (w === 1) buildSquad(m, market, byId);
      else weeklyMoves(m, byId, market);
      pickArmbands(m, byId);
      m.team = rollover(m.team, w + 1);
      const result = scoreWeek(m.team.history[w], scores, m.team.info, { final: true });
      m.weekly.push(result.total);
      for (const r of [...result.rows, ...result.benchRows]) if (m.protect.has(r.id) && r.slot !== 'BN') m.stashPts += r.pts;
    }
  }
  const last = weeksData.at(-1).byId;
  return managers.map((m) => ({
    id: m.id,
    style: m.style,
    total: m.weekly.reduce((a, b) => a + b, 0),
    weekly: m.weekly,
    transfers: Object.values(m.team.history).reduce((s, h) => s + h.transfers, 0),
    hits: Object.values(m.team.history).reduce((s, h) => s + h.hits, 0),
    value: teamValue(m.team, last),
    stashPts: m.stashPts,
  }));
}

// --- Analysis ------------------------------------------------------------------
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const sd = (xs) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)));
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;

function corr(xs, ys) {
  const mx = mean(xs);
  const my = mean(ys);
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  return num / Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0) * ys.reduce((s, y) => s + (y - my) ** 2, 0));
}

function summarise(results) {
  const ranked = [...results].sort((a, b) => b.total - a.total);
  const topN = (n) => ranked.slice(0, Math.max(1, Math.round(results.length * n)));
  const byStyle = {};
  for (const [style] of STYLES) {
    const rs = results.filter((r) => r.style === style);
    byStyle[style] = {
      n: rs.length,
      mean: r1(mean(rs.map((r) => r.total))),
      sd: r1(sd(rs.map((r) => r.total))),
      best: r1(Math.max(...rs.map((r) => r.total))),
      top10pct: topN(0.1).filter((r) => r.style === style).length,
      top1pct: topN(0.01).filter((r) => r.style === style).length,
      transfers: r1(mean(rs.map((r) => r.transfers))),
      hits: r1(mean(rs.map((r) => r.hits))),
      value: r1(mean(rs.map((r) => r.value)) / 10),
    };
  }
  // Does early luck snowball? Correlate points after 6 weeks with final rank order.
  const early = results.map((r) => r.weekly.slice(0, 6).reduce((a, b) => a + b, 0));
  const late = results.map((r) => r.weekly.slice(6).reduce((a, b) => a + b, 0));
  const stashers = results.filter((r) => r.style === 'stash');
  return {
    byStyle,
    spread: { mean: r1(mean(results.map((r) => r.total))), sd: r1(sd(results.map((r) => r.total))), winner: r1(ranked[0].total), winnerStyle: ranked[0].style },
    earlyLateCorr: r2(corr(early, late)),
    stashPtsVsTotalCorr: stashers.length > 2 ? r2(corr(stashers.map((r) => r.stashPts), stashers.map((r) => r.total))) : null,
    stashPtsMean: r1(mean(stashers.map((r) => r.stashPts))),
  };
}

/** Biggest week-on-week price moves in one direction (sign 1 = rises, -1 = falls). */
function bigMoves(weeksData, data, sign, n) {
  const out = [];
  for (let w = 2; w <= weeksData.length; w++) {
    const prev = weeksData[w - 2].byId;
    const playedPrev = new Set((data.stats[w - 1] ?? []).filter((r) => r.stats?.gp > 0).map((r) => r.player_id));
    for (const p of weeksData[w - 1].market) {
      const before = prev.get(p.id);
      if (!before || sign * (p.price - before.price) <= 0) continue;
      const mates = weeksData[w - 2].market.filter((q) => q.team === p.team && q.pos === p.pos && q.id !== p.id && q.price > before.price);
      const injuredMate = sign > 0 && mates.find((q) => !playedPrev.has(q.id));
      out.push({ week: w, name: p.name, pos: p.pos, team: p.team, from: before.price, to: p.price, cause: injuredMate ? `${injuredMate.name} missed wk ${w - 1}` : '' });
    }
  }
  return out.sort((x, y) => sign * (y.to - y.from) - sign * (x.to - x.from)).slice(0, n);
}

function moveStats(weeksData) {
  const moves = [];
  for (let w = 2; w <= weeksData.length; w++) {
    for (const p of weeksData[w - 1].market) {
      const before = weeksData[w - 2].byId.get(p.id);
      if (before) moves.push(p.price - before.price);
    }
  }
  return { meanAbs: r2(mean(moves.map(Math.abs)) / 10), big: moves.filter((m) => Math.abs(m) >= 15).length };
}

const pricePath = (weeksData, name) => weeksData.map(({ market }) => market.find((p) => p.name === name)?.price);

// --- Run -----------------------------------------------------------------------
const data = await loadSeason(season);
console.log(`Building ${data.weeks} weekly markets for ${season}…`);

const MARKETS = {
  uncapped: { label: 'Uncapped prices', weeks: replaySeason(data, null) },
  asym: { label: `Up ${fmtPrice(PRICE_MOVES.maxRise)} / down ${fmtPrice(PRICE_MOVES.maxFall)} a week`, weeks: replaySeason(data) },
  sym: { label: `Up/down ${fmtPrice(PRICE_MOVES.maxRise)} a week`, weeks: replaySeason(data, { maxRise: PRICE_MOVES.maxRise, maxFall: PRICE_MOVES.maxRise }) },
};
const BENCH = { starterSlots: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'K', 'DEF'], benchSize: 6 };

const VARIANTS = [
  { name: MARKETS.uncapped.label, market: 'uncapped', rules: {} },
  { name: `Proposed: ${MARKETS.asym.label}`, market: 'asym', rules: {} },
  { name: MARKETS.sym.label, market: 'sym', rules: {} },
  { name: 'Proposed caps + no profit on sales', market: 'asym', rules: { keepProfitShare: 0 } },
  { name: 'Proposed caps + 1 FT per week', market: 'asym', rules: { freeTransfersPerWeek: 1 } },
  { name: 'Proposed caps + old format (9 starters + 6 bench, autosubs)', market: 'asym', rules: BENCH },
];
const PATH_PLAYERS = ['Lamar Jackson', 'Joe Burrow', 'Mike Evans', 'Bucky Irving'];

const report = { season, managers: MANAGERS, variants: [], markets: {} };
for (const v of VARIANTS) {
  const saved = { ...RULES };
  Object.assign(RULES, v.rules);
  const t0 = Date.now();
  const results = runVariant(MARKETS[v.market].weeks);
  Object.assign(RULES, saved);
  report.variants.push({ name: v.name, market: v.market, rules: v.rules, ...summarise(results) });
  console.log(`${v.name}: done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
for (const [key, m] of Object.entries(MARKETS)) {
  report.markets[key] = {
    label: m.label,
    ...moveStats(m.weeks),
    rises: bigMoves(m.weeks, data, 1, 12),
    falls: bigMoves(m.weeks, data, -1, 8),
    paths: Object.fromEntries(PATH_PLAYERS.map((name) => [name, pricePath(m.weeks, name)])),
  };
}

// --- Write -----------------------------------------------------------------------
const lines = [`# Replay: ${season} season, ${MANAGERS} simulated managers`, ''];
lines.push('Styles: **active** transfers each week; **stash** is active but also holds the backups of its two priciest RBs and never sells them; **passive** never transfers.', '');
lines.push(
  "**How it works.** Each week is priced from data available at that deadline: season-to-date stats, the preseason projection, and that week's projection. A player known to be out is priced on form alone. Every manager values players the same way (this week's projection plus 3 weeks of expected ppg), with personal taste noise (SD 15%) so squads differ. Active managers make up to 4 transfers a week if each gains 2+ projected points (10+ when it costs a hit). Captain is the best non-QB projection.",
  '',
  "**Caveats.** Sleeper's archived weekly projections are final versions that already know Sunday inactives. The replay treats a player as known to be out only if he also missed his team's previous game; a fresh absence stays hidden until after the deadline. Backups' archived projections may still reflect news slightly early. Managers ignore bench roles, so the old bench format is a rough comparison.",
  '',
);
lines.push('## Summary', '', '| Variant | Active | Stash | Passive | Stashers in top 10% | Active team value |', '|---|---|---|---|---|---|');
for (const v of report.variants) {
  const s = v.byStyle;
  lines.push(`| ${v.name} | ${s.active.mean} | ${s.stash.mean} | ${s.passive.mean} | ${s.stash.top10pct} of ${Math.round(MANAGERS / 10)} | £${s.active.value}m |`);
}
lines.push('');
for (const v of report.variants) {
  lines.push(`## ${v.name}`, '');
  lines.push('| Style | n | Mean pts | SD | Best | Top 10% | Top 1% | Transfers | Hits | Team value |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const [style, s] of Object.entries(v.byStyle)) {
    lines.push(`| ${style} | ${s.n} | ${s.mean} | ${s.sd} | ${s.best} | ${s.top10pct} | ${s.top1pct} | ${s.transfers} | ${s.hits} | £${s.value}m |`);
  }
  lines.push('', `Winner ${v.spread.winner} pts (${v.spread.winnerStyle}). Field mean ${v.spread.mean}, SD ${v.spread.sd}.`);
  lines.push(`Correlation of weeks 1–6 points with weeks 7–${data.weeks} points: ${v.earlyLateCorr}.`);
  lines.push(`Stashers: mean ${v.stashPtsMean} pts from their stashed backups; correlation with season total ${v.stashPtsVsTotalCorr}.`, '');
}
for (const m of Object.values(report.markets)) {
  lines.push(`## Price behaviour: ${m.label}`, '', `Average weekly move £${m.meanAbs}m; ${m.big} moves of £1.5m or more.`, '');
  lines.push('| Player | Price by week |', '|---|---|');
  for (const [name, path] of Object.entries(m.paths)) lines.push(`| ${name} | ${path.map((p) => (p == null ? '-' : (p / 10).toFixed(1))).join(' ')} |`);
  lines.push('', '| Biggest rises | Pos | Week | Price | Likely cause |', '|---|---|---|---|---|');
  for (const b of m.rises) lines.push(`| ${b.name} (${b.team}) | ${b.pos} | ${b.week} | ${fmtPrice(b.from)} → ${fmtPrice(b.to)} | ${b.cause} |`);
  lines.push('', '| Biggest falls | Pos | Week | Price |', '|---|---|---|---|');
  for (const b of m.falls) lines.push(`| ${b.name} (${b.team}) | ${b.pos} | ${b.week} | ${fmtPrice(b.from)} → ${fmtPrice(b.to)} |`);
  lines.push('');
}

const dir = new URL('../reports/', import.meta.url);
await mkdir(dir, { recursive: true });
await writeFile(new URL(`replay-${season}.md`, dir), lines.join('\n') + '\n');
await writeFile(new URL(`replay-${season}.json`, dir), JSON.stringify(report, null, 1));
console.log(`Wrote reports/replay-${season}.md`);
