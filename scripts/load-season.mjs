// Load a season cached by fetch-season.mjs into the shape replayWeek expects.
import { readFile } from 'node:fs/promises';
import { withResults } from '../src/core/results.js';

// Downloads from before the switch to PPR have no pts_ppr. It is half PPR plus half a
// point per catch, so fill it in rather than making every season be fetched again.
const withPpr = (rows) => {
  for (const r of rows) if (r.stats?.pts_ppr == null && r.stats?.pts_half_ppr != null) r.stats.pts_ppr = r.stats.pts_half_ppr + 0.5 * (r.stats.rec ?? 0);
  return rows;
};

export async function loadSeason(season) {
  const dir = new URL(`../data/${season}/`, import.meta.url);
  const read = async (name) => JSON.parse(await readFile(new URL(name, dir), 'utf8'));
  const readRows = async (name) => withPpr(await read(name));
  // Final scores were added to the fetch later, so older downloads may not have them.
  const results = await read('results.json').catch(() => []);
  const schedule = withResults(await read('schedule.json'), results);
  const weeks = Math.max(...schedule.map((g) => g.week));
  const data = { season, weeks, schedule, seasonProj: await readRows('season-proj.json'), proj: {}, stats: {} };
  for (let w = 1; w <= weeks; w++) {
    data.proj[w] = await readRows(`proj-${w}.json`);
    data.stats[w] = await readRows(`stats-${w}.json`);
  }
  return data;
}
