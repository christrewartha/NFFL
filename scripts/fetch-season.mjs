// Download one season of Sleeper data for the replay, trimmed to what it uses, plus
// final scores from ESPN.
// Usage: node scripts/fetch-season.mjs [season]   -> data/{season}/*.json

import { mkdir, writeFile } from 'node:fs/promises';
import { POSITIONS } from '../src/core/rules.js';
import { BOX_KEYS } from '../src/core/statLines.js';
import { fetchWeekResults } from '../src/core/results.js';

const season = Number(process.argv[2] ?? 2025);
const API = 'https://api.sleeper.app';
const positionQuery = POSITIONS.map((p) => `position[]=${p}`).join('&');
const STAT_KEYS = ['pts_half_ppr', 'gp', 'off_snp', 'tm_off_snp', ...BOX_KEYS];

async function getJson(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`Sleeper ${path} failed (${res.status})`);
  return res.json();
}

const trim = (rows) =>
  rows
    .filter((r) => r.player && POSITIONS.includes(r.player.position))
    .map((r) => ({
      player_id: r.player_id,
      team: r.team,
      opponent: r.opponent ?? null,
      player: { first_name: r.player.first_name, last_name: r.player.last_name, position: r.player.position },
      stats: Object.fromEntries(STAT_KEYS.filter((k) => r.stats?.[k] != null).map((k) => [k, r.stats[k]])),
    }));

const dir = new URL(`../data/${season}/`, import.meta.url);
await mkdir(dir, { recursive: true });
const put = (name, data) => writeFile(new URL(name, dir), JSON.stringify(data));

const schedule = await getJson(`/schedule/nfl/regular/${season}`);
await put('schedule.json', schedule);
await put('season-proj.json', trim(await getJson(`/projections/nfl/${season}?season_type=regular&${positionQuery}`)));
const weeks = Math.max(...schedule.map((g) => g.week));
const results = [];
for (let w = 1; w <= weeks; w++) {
  results.push(...(await fetchWeekResults(season, w)).map((r) => ({ week: w, ...r })));
  const [proj, stats] = await Promise.all([
    getJson(`/projections/nfl/${season}/${w}?season_type=regular&${positionQuery}`),
    getJson(`/stats/nfl/${season}/${w}?season_type=regular&${positionQuery}`),
  ]);
  await put(`proj-${w}.json`, trim(proj));
  await put(`stats-${w}.json`, trim(stats));
  process.stdout.write(`week ${w} `);
}
await put('results.json', results);
console.log(`\nSaved ${season} to data/${season}/ (${results.length} final scores)`);
