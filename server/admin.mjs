// League admin from the command line.
//   node server/admin.mjs create --name "The Crew" --season 2022 --start 2026-11-10 [--deadline 20:00]
//   node server/admin.mjs list
//   node server/admin.mjs managers <CODE>
//   node server/admin.mjs reset-pin <CODE> <name> <newpin>

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

if (cmd === 'create') {
  const name = flag('name') ?? fail('--name is required');
  const season = Number(flag('season', 2022));
  const startDate = flag('start') ?? fail('--start YYYY-MM-DD is required (date of the week 1 deadline)');
  const deadlineTime = flag('deadline', '20:00');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{2}:\d{2}$/.test(deadlineTime)) fail('Use --start YYYY-MM-DD and --deadline HH:MM');
  if (!existsSync(join(ROOT, 'data', String(season), 'schedule.json'))) fail(`No data for ${season}. Run: node scripts/fetch-season.mjs ${season}`);
  const code = newCode();
  store.addLeague({ code, name, season, startDate, deadlineTime });
  const weeks = leagueWeeks({ startDate, deadlineTime, weeks: 18 });
  console.log(`Created "${name}" (${season} season). League code: ${code}`);
  console.log(`Week 1 deadline ${new Date(weeks[0].deadline).toString()}; week 18 ${new Date(weeks.at(-1).deadline).toString()}.`);
} else if (cmd === 'list') {
  for (const l of store.leagues()) console.log(`${l.code}  ${l.name}  season ${l.season}, starts ${l.start_date} ${l.deadline_time}, ${store.managers(l.code).length} managers`);
} else if (cmd === 'managers') {
  for (const m of store.managers(args[0])) console.log(`${m.name}${m.team ? '' : ' (no team yet)'}`);
} else if (cmd === 'reset-pin') {
  const [code, name, pin] = args;
  const m = store.managerByName(code, name ?? '') ?? fail('No such manager');
  if (!/^\d{4,8}$/.test(pin ?? '')) fail('PIN must be 4 to 8 digits');
  store.setPin(m.id, pin);
  console.log(`PIN reset for ${m.name}`);
} else {
  console.log('Commands: create, list, managers <CODE>, reset-pin <CODE> <name> <pin>  (see the top of this file)');
}
