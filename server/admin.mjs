// League admin from the command line.
//   node server/admin.mjs create --name "The Crew" --season 2022 --start 2026-11-10 [--deadline 22:00] [--update 60]
//   node server/admin.mjs set <CODE> [--start YYYY-MM-DD] [--deadline HH:MM] [--update MINUTES]
//   node server/admin.mjs list
//   node server/admin.mjs managers <CODE>
//   node server/admin.mjs reset-pin <CODE> <name> <newpin>
// Times are UK time. --update is how long the league is offline after each deadline.

import { existsSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore } from './store.mjs';
import { leagueWeeks } from '../src/core/league.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const store = openStore(process.env.DB_PATH ?? join(ROOT, 'server', 'nffl.db'));
const [cmd, ...args] = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
// No 0/O or 1/I, so codes are easy to read out.
const newCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('');
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

function checkSchedule(startDate, deadlineTime, updateMinutes) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{2}:\d{2}$/.test(deadlineTime)) fail('Use --start YYYY-MM-DD and --deadline HH:MM');
  if (!Number.isInteger(updateMinutes) || updateMinutes < 0 || updateMinutes >= 24 * 60) fail('--update must be a whole number of minutes, under a day');
}

function describe({ startDate, deadlineTime, updateMinutes }) {
  const weeks = leagueWeeks({ startDate, deadlineTime, updateMinutes, weeks: 18 });
  const uk = (t) => new Date(t).toLocaleString('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  console.log(`Week 1 deadline ${uk(weeks[0].deadline)}, offline until ${uk(weeks[0].reopens)}. Week 18 deadline ${uk(weeks.at(-1).deadline)}. (UK time)`);
}

if (cmd === 'create') {
  const name = flag('name') ?? fail('--name is required');
  const season = Number(flag('season', 2022));
  const startDate = flag('start') ?? fail('--start YYYY-MM-DD is required (date of the week 1 deadline)');
  const deadlineTime = flag('deadline', '22:00');
  const updateMinutes = Number(flag('update', 60));
  checkSchedule(startDate, deadlineTime, updateMinutes);
  if (!existsSync(join(ROOT, 'data', String(season), 'schedule.json'))) fail(`No data for ${season}. Run: node scripts/fetch-season.mjs ${season}`);
  const code = newCode();
  store.addLeague({ code, name, season, startDate, deadlineTime, updateMinutes });
  console.log(`Created "${name}" (${season} season). League code: ${code}`);
  describe({ startDate, deadlineTime, updateMinutes });
} else if (cmd === 'set') {
  const league = store.league((args[0] ?? '').toUpperCase()) ?? fail('No league with that code');
  const startDate = flag('start', league.start_date);
  const deadlineTime = flag('deadline', league.deadline_time);
  const updateMinutes = Number(flag('update', league.update_minutes));
  checkSchedule(startDate, deadlineTime, updateMinutes);
  store.setSchedule(league.code, { startDate, deadlineTime, updateMinutes });
  console.log(`Updated ${league.code} (${league.name}).`);
  describe({ startDate, deadlineTime, updateMinutes });
} else if (cmd === 'list') {
  for (const l of store.leagues()) {
    console.log(`${l.code}  ${l.name}  season ${l.season}, starts ${l.start_date}, deadline ${l.deadline_time} then offline ${l.update_minutes} min, ${store.managers(l.code).length} managers`);
  }
} else if (cmd === 'managers') {
  for (const m of store.managers(args[0])) console.log(`${m.name}${m.team ? '' : ' (no team yet)'}`);
} else if (cmd === 'reset-pin') {
  const [code, name, pin] = args;
  const m = store.managerByName(code, name ?? '') ?? fail('No such manager');
  if (!/^\d{4,8}$/.test(pin ?? '')) fail('PIN must be 4 to 8 digits');
  store.setPin(m.id, pin);
  console.log(`PIN reset for ${m.name}`);
} else {
  console.log('Commands: create, set <CODE>, list, managers <CODE>, reset-pin <CODE> <name> <pin>  (see the top of this file)');
}
