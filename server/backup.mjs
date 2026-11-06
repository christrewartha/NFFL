// Back up the league database while the server keeps running.
//   node server/backup.mjs [--dir backups] [--keep 14]
// Uses SQLite's online backup, so the copy is consistent even mid-write. Each copy is
// checked, then copies older than --keep days are deleted. Run it nightly from cron and
// sync the folder off the machine (see the README).

import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync, backup } from 'node:sqlite';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const source = process.env.DB_PATH ?? join(ROOT, 'server', 'nffl.db');
const dir = resolve(ROOT, flag('dir', 'backups'));
const keepDays = Number(flag('keep', 14));
const PREFIX = 'nffl-';

const stamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-'); // 20261107-033000
const target = join(dir, `${PREFIX}${stamp}.db`);

mkdirSync(dir, { recursive: true });
const db = new DatabaseSync(source);
await backup(db, target);
db.close();

// Make the copy a single self-contained file (the live DB uses WAL, which adds side files),
// then check it's intact and has the tables we expect.
const copy = new DatabaseSync(target);
copy.exec('PRAGMA journal_mode = DELETE');
const integrity = copy.prepare('PRAGMA integrity_check').get().integrity_check;
const counts = copy.prepare('SELECT (SELECT COUNT(*) FROM leagues) AS leagues, (SELECT COUNT(*) FROM managers) AS managers').get();
copy.close();
if (integrity !== 'ok') {
  console.error(`Backup ${target} failed its integrity check: ${integrity}`);
  process.exit(1);
}

const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
const pruned = readdirSync(dir)
  .filter((f) => f.startsWith(PREFIX) && f.endsWith('.db'))
  .map((f) => join(dir, f))
  .filter((f) => f !== target && statSync(f).mtimeMs < cutoff);
for (const f of pruned) rmSync(f);

console.log(`${new Date().toISOString()} backed up ${counts.leagues} league(s), ${counts.managers} manager(s) to ${target}${pruned.length ? `; removed ${pruned.length} older than ${keepDays} days` : ''}`);
