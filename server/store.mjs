// SQLite persistence (Node's built-in node:sqlite, no install needed).

import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function openStore(path) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS leagues (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      season INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      deadline_time TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS managers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      league_code TEXT NOT NULL REFERENCES leagues(code),
      name TEXT NOT NULL,
      name_key TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      team_json TEXT,
      created_at INTEGER NOT NULL,
      UNIQUE (league_code, name_key)
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      manager_id INTEGER NOT NULL REFERENCES managers(id),
      created_at INTEGER NOT NULL
    );
  `);

  // Columns added after the first release, for databases created before them.
  const leagueColumns = db.prepare('PRAGMA table_info(leagues)').all().map((c) => c.name);
  if (!leagueColumns.includes('update_minutes')) db.exec('ALTER TABLE leagues ADD COLUMN update_minutes INTEGER NOT NULL DEFAULT 60');

  const q = {
    league: db.prepare('SELECT * FROM leagues WHERE code = ?'),
    leagues: db.prepare('SELECT * FROM leagues ORDER BY created_at'),
    addLeague: db.prepare('INSERT INTO leagues (code, name, season, start_date, deadline_time, update_minutes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    setSchedule: db.prepare('UPDATE leagues SET start_date = ?, deadline_time = ?, update_minutes = ? WHERE code = ?'),
    manager: db.prepare('SELECT * FROM managers WHERE id = ?'),
    managerByName: db.prepare('SELECT * FROM managers WHERE league_code = ? AND name_key = ?'),
    managers: db.prepare('SELECT * FROM managers WHERE league_code = ? ORDER BY created_at'),
    addManager: db.prepare('INSERT INTO managers (league_code, name, name_key, pin_hash, created_at) VALUES (?, ?, ?, ?, ?)'),
    saveTeam: db.prepare('UPDATE managers SET team_json = ? WHERE id = ?'),
    setPin: db.prepare('UPDATE managers SET pin_hash = ? WHERE id = ?'),
    session: db.prepare('SELECT manager_id FROM sessions WHERE token = ?'),
    addSession: db.prepare('INSERT INTO sessions (token, manager_id, created_at) VALUES (?, ?, ?)'),
    dropSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
  };

  const withTeam = (row) => row && { ...row, team: row.team_json ? JSON.parse(row.team_json) : null };

  return {
    league: (code) => q.league.get(code),
    leagues: () => q.leagues.all(),
    addLeague: ({ code, name, season, startDate, deadlineTime, updateMinutes = 60 }) => q.addLeague.run(code, name, season, startDate, deadlineTime, updateMinutes, Date.now()),
    setSchedule: (code, { startDate, deadlineTime, updateMinutes }) => q.setSchedule.run(startDate, deadlineTime, updateMinutes, code),
    manager: (id) => withTeam(q.manager.get(id)),
    managerByName: (code, name) => withTeam(q.managerByName.get(code, nameKey(name))),
    managers: (code) => q.managers.all(code).map(withTeam),
    addManager: (code, name, pin) => Number(q.addManager.run(code, name.trim(), nameKey(name), hashPin(pin), Date.now()).lastInsertRowid),
    saveTeam: (id, team) => q.saveTeam.run(JSON.stringify(team), id),
    setPin: (id, pin) => q.setPin.run(hashPin(pin), id),
    session: (token) => q.session.get(token)?.manager_id ?? null,
    newSession: (managerId) => {
      const token = randomBytes(24).toString('base64url');
      q.addSession.run(token, managerId, Date.now());
      return token;
    },
    dropSession: (token) => q.dropSession.run(token),
  };
}

export const nameKey = (name) => name.trim().toLowerCase().replace(/\s+/g, ' ');

export function hashPin(pin) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(String(pin), salt, 32).toString('hex')}`;
}

export function checkPin(pin, stored) {
  const [salt, hash] = stored.split(':');
  const given = scryptSync(String(pin), salt, 32);
  return timingSafeEqual(given, Buffer.from(hash, 'hex'));
}
