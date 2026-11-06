// Load a season cached by fetch-season.mjs into the shape replayWeek expects.
import { readFile } from 'node:fs/promises';
import { withResults } from '../src/core/results.js';

export async function loadSeason(season) {
  const dir = new URL(`../data/${season}/`, import.meta.url);
  const read = async (name) => JSON.parse(await readFile(new URL(name, dir), 'utf8'));
  // Final scores were added to the fetch later, so older downloads may not have them.
  const results = await read('results.json').catch(() => []);
  const schedule = withResults(await read('schedule.json'), results);
  const weeks = Math.max(...schedule.map((g) => g.week));
  const data = { season, weeks, schedule, seasonProj: await read('season-proj.json'), proj: {}, stats: {} };
  for (let w = 1; w <= weeks; w++) {
    data.proj[w] = await read(`proj-${w}.json`);
    data.stats[w] = await read(`stats-${w}.json`);
  }
  return data;
}
