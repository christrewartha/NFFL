// League admin from the command line.
//   node server/admin.mjs status                         season, start week, this week's times
//   node server/admin.mjs accounts                       everyone signed up
//   node server/admin.mjs leagues                        mini-leagues and their members
//   node server/admin.mjs reset-password <name> <new>    for someone who's forgotten theirs
//   node server/admin.mjs start-week <n>                 change the first week (before anyone plays)
// Times are UK time.

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore } from './store.mjs';
import { leagueOpenWeek, leagueWeeks } from '../src/core/league.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const store = openStore(process.env.DB_PATH ?? join(ROOT, 'server', 'nffl.db'));
const [cmd, ...args] = process.argv.slice(2);
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};
const uk = (t) => (t == null ? '-' : new Date(t).toLocaleString('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));
const season = Number(store.setting('season')) || null;

if (cmd === 'status') {
  const startWeek = Number(store.setting('startWeek')) || null;
  if (!season) fail('The league has not started yet: start the server and it sets itself up.');
  const games = store.calendar(season)?.games ?? [];
  const weeks = leagueWeeks(games, startWeek);
  const open = leagueOpenWeek(weeks);
  console.log(`${season} season from Week ${startWeek}. ${store.teams(season).length} team(s), ${store.accounts().length} account(s).`);
  if (open) {
    const w = weeks[open - 1];
    const m = store.market(season, open);
    console.log(`Week ${open}: first kickoff ${uk(w.deadline)}, processed ${uk(w.processAt)}.`);
    console.log(m ? `Prices: ${m.players.length} players${m.provisional ? ' (provisional)' : ''}, updated ${uk(m.updatedAt)}.` : 'Prices: not set yet.');
  } else {
    console.log('The regular season is over.');
  }
} else if (cmd === 'accounts') {
  for (const a of store.accounts()) {
    const team = season && store.team(a.id, season);
    console.log(`${a.name}${team ? `, from Week ${team.createdWeek}` : ' (no team yet)'}`);
  }
} else if (cmd === 'leagues') {
  for (const l of store.allMinileagues()) {
    const names = [...store.members(l.id)].map((id) => store.account(id)?.name);
    console.log(`${l.code}  ${l.name} (${l.season}): ${names.join(', ')}`);
  }
} else if (cmd === 'reset-password') {
  const [name, password] = args;
  const a = store.accountByName(name ?? '') ?? fail('No account with that name');
  if ((password ?? '').length < 6) fail('Passwords need at least 6 characters');
  store.setPassword(a.id, password);
  console.log(`Password reset for ${a.name}`);
} else if (cmd === 'start-week') {
  const week = Number(args[0]);
  if (!Number.isInteger(week) || week < 1 || week > 18) fail('Give a week from 1 to 18');
  if (season && store.teams(season).some((t) => Object.keys(t.team.history ?? {}).length)) fail('Teams have already played a week, so the start week can no longer change');
  store.setSetting('startWeek', week);
  console.log(`The league now starts in Week ${week}. Restart the server to pick it up.`);
} else {
  console.log('Commands: status, accounts, leagues, reset-password <name> <password>, start-week <n>  (see the top of this file)');
}
