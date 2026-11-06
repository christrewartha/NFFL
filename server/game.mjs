// League game logic on the server: the replayed season, each league's clock, and
// keeping every team rolled over and scored. Uses the same core code as the browser.

import { loadSeason } from '../scripts/load-season.mjs';
import { replaySeason } from '../src/core/replay.js';
import { leagueOpenWeek, leagueWeeks } from '../src/core/league.js';
import { newTeam, rollover, scoreWeek } from '../src/core/squad.js';

const seasons = new Map();

async function loadReplay(season) {
  if (!seasons.has(season)) {
    const data = await loadSeason(season);
    seasons.set(season, {
      weeks: replaySeason(data),
      // The fixture list is public knowledge (as in a real season), so it's safe to send.
      schedule: data.schedule.map(({ week, home, away }) => ({ week, home, away })),
    });
  }
  return seasons.get(season);
}

/** The replayed season (capped prices), built once per season and kept in memory. */
export const seasonWeeks = async (season) => (await loadReplay(season)).weeks;
export const seasonSchedule = async (season) => (await loadReplay(season)).schedule;

export function clock(league, totalWeeks, now = Date.now()) {
  const weeks = leagueWeeks({ startDate: league.start_date, deadlineTime: league.deadline_time, weeks: totalWeeks }, now);
  const open = leagueOpenWeek(weeks);
  return { weeks, open, rolloverTo: open ?? totalWeeks + 1 };
}

/** The manager's team brought up to date with the clock (new managers start in the open week). */
export function currentTeam(manager, league, c) {
  const team = manager.team ?? newTeam(league.season, c.rolloverTo);
  return rollover(team, c.rolloverTo);
}

/** Points for each locked week: [{ week, total, ...scoreWeek }]. */
export function results(team, season) {
  return Object.keys(team?.history ?? {})
    .map(Number)
    .sort((a, b) => a - b)
    .map((week) => ({ week, ...scoreWeek(team.history[week], season[week - 1].scores, team.info, { final: true }) }));
}
