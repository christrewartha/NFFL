import { createContext, useContext, useMemo } from 'react';
import { teamFixtures } from '../core/gameweeks.js';

/**
 * What the player screens need to know about the season: the fixture list, the week
 * open for changes (null once it's over), and getLog(player), which resolves to
 * [{ week, pts, played }] for weeks already played.
 */
export const SeasonContext = createContext({ schedule: [], week: null, getLog: null });
export const useSeason = () => useContext(SeasonContext);

/** fixturesOf(team): that team's week-by-week fixtures, computed once per team. */
export function useFixtures() {
  const { schedule } = useSeason();
  return useMemo(() => {
    const cache = new Map();
    return (team) => {
      if (!cache.has(team)) cache.set(team, teamFixtures(schedule, team));
      return cache.get(team);
    };
  }, [schedule]);
}

export const byeWeek = (fixtures) => fixtures.find((f) => f.bye)?.week ?? null;
