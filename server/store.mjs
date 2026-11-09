// SQLite persistence (Node's built-in node:sqlite, no install needed).
//
// One game: the live NFL season. Everyone has an account with one team per season, and
// every team is on the overall table. Mini-leagues are just lists of accounts.
// (The leagues, managers and sessions tables are from the replay trial and are unused.)

import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';

export function openStore(path) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_key TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS logins (
      token TEXT PRIMARY KEY,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS teams (
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      season INTEGER NOT NULL,
      team_json TEXT NOT NULL,
      PRIMARY KEY (account_id, season)
    );
    CREATE TABLE IF NOT EXISTS minileagues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      season INTEGER NOT NULL,
      owner_id INTEGER NOT NULL REFERENCES accounts(id),
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS minileague_members (
      league_id INTEGER NOT NULL REFERENCES minileagues(id),
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      joined_at INTEGER NOT NULL,
      PRIMARY KEY (league_id, account_id)
    );
    -- Each week's prices, set when the week opens so restarts never move them.
    CREATE TABLE IF NOT EXISTS markets (
      season INTEGER NOT NULL,
      week INTEGER NOT NULL,
      players_json TEXT NOT NULL,
      provisional INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (season, week)
    );
    -- Each week's player scores: live while games are on, final once processed.
    CREATE TABLE IF NOT EXISTS week_scores (
      season INTEGER NOT NULL,
      week INTEGER NOT NULL,
      scores_json TEXT NOT NULL,
      final INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (season, week)
    );
    -- The season's games with kickoff times, status and final scores.
    CREATE TABLE IF NOT EXISTS calendar (
      season INTEGER PRIMARY KEY,
      games_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  const q = {
    setting: db.prepare('SELECT value FROM settings WHERE key = ?'),
    setSetting: db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value'),
    account: db.prepare('SELECT * FROM accounts WHERE id = ?'),
    accountByName: db.prepare('SELECT * FROM accounts WHERE name_key = ?'),
    accounts: db.prepare('SELECT * FROM accounts ORDER BY created_at'),
    addAccount: db.prepare('INSERT INTO accounts (name, name_key, password_hash, created_at) VALUES (?, ?, ?, ?)'),
    setPassword: db.prepare('UPDATE accounts SET password_hash = ? WHERE id = ?'),
    login: db.prepare('SELECT account_id FROM logins WHERE token = ?'),
    addLogin: db.prepare('INSERT INTO logins (token, account_id, created_at) VALUES (?, ?, ?)'),
    dropLogin: db.prepare('DELETE FROM logins WHERE token = ?'),
    team: db.prepare('SELECT team_json FROM teams WHERE account_id = ? AND season = ?'),
    teams: db.prepare('SELECT t.account_id, a.name, t.team_json FROM teams t JOIN accounts a ON a.id = t.account_id WHERE t.season = ? ORDER BY a.created_at'),
    saveTeam: db.prepare('INSERT INTO teams (account_id, season, team_json) VALUES (?, ?, ?) ON CONFLICT (account_id, season) DO UPDATE SET team_json = excluded.team_json'),
    minileague: db.prepare('SELECT * FROM minileagues WHERE id = ?'),
    minileagueByCode: db.prepare('SELECT * FROM minileagues WHERE code = ?'),
    allMinileagues: db.prepare('SELECT * FROM minileagues ORDER BY created_at'),
    minileaguesOf: db.prepare(`
      SELECT l.*, (SELECT COUNT(*) FROM minileague_members x WHERE x.league_id = l.id) AS size
      FROM minileagues l JOIN minileague_members m ON m.league_id = l.id
      WHERE m.account_id = ? AND l.season = ? ORDER BY m.joined_at`),
    addMinileague: db.prepare('INSERT INTO minileagues (code, name, season, owner_id, created_at) VALUES (?, ?, ?, ?, ?)'),
    members: db.prepare('SELECT account_id FROM minileague_members WHERE league_id = ?'),
    isMember: db.prepare('SELECT 1 FROM minileague_members WHERE league_id = ? AND account_id = ?'),
    join: db.prepare('INSERT OR IGNORE INTO minileague_members (league_id, account_id, joined_at) VALUES (?, ?, ?)'),
    leave: db.prepare('DELETE FROM minileague_members WHERE league_id = ? AND account_id = ?'),
    marketStamp: db.prepare('SELECT updated_at, provisional FROM markets WHERE season = ? AND week = ?'),
    market: db.prepare('SELECT * FROM markets WHERE season = ? AND week = ?'),
    saveMarket: db.prepare('INSERT INTO markets (season, week, players_json, provisional, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (season, week) DO UPDATE SET players_json = excluded.players_json, provisional = excluded.provisional, updated_at = excluded.updated_at'),
    scoresStamp: db.prepare('SELECT updated_at, final FROM week_scores WHERE season = ? AND week = ?'),
    scores: db.prepare('SELECT * FROM week_scores WHERE season = ? AND week = ?'),
    saveScores: db.prepare('INSERT INTO week_scores (season, week, scores_json, final, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (season, week) DO UPDATE SET scores_json = excluded.scores_json, final = excluded.final, updated_at = excluded.updated_at'),
    calendar: db.prepare('SELECT * FROM calendar WHERE season = ?'),
    saveCalendar: db.prepare('INSERT INTO calendar (season, games_json, updated_at) VALUES (?, ?, ?) ON CONFLICT (season) DO UPDATE SET games_json = excluded.games_json, updated_at = excluded.updated_at'),
  };

  return {
    setting: (key) => q.setting.get(key)?.value ?? null,
    setSetting: (key, value) => q.setSetting.run(key, String(value)),

    account: (id) => q.account.get(id),
    accountByName: (name) => q.accountByName.get(nameKey(name)),
    accounts: () => q.accounts.all(),
    addAccount: (name, password) => Number(q.addAccount.run(name.trim(), nameKey(name), hashSecret(password), Date.now()).lastInsertRowid),
    setPassword: (id, password) => q.setPassword.run(hashSecret(password), id),
    login: (token) => q.login.get(token)?.account_id ?? null,
    newLogin: (accountId) => {
      const token = randomBytes(24).toString('base64url');
      q.addLogin.run(token, accountId, Date.now());
      return token;
    },
    dropLogin: (token) => q.dropLogin.run(token),

    team: (accountId, season) => {
      const row = q.team.get(accountId, season);
      return row ? JSON.parse(row.team_json) : null;
    },
    /** Every team in the season: [{ accountId, name, team }]. */
    teams: (season) => q.teams.all(season).map((r) => ({ accountId: r.account_id, name: r.name, team: JSON.parse(r.team_json) })),
    saveTeam: (accountId, season, team) => q.saveTeam.run(accountId, season, JSON.stringify(team)),

    minileague: (id) => q.minileague.get(id),
    minileagueByCode: (code) => q.minileagueByCode.get(code),
    allMinileagues: () => q.allMinileagues.all(),
    minileaguesOf: (accountId, season) => q.minileaguesOf.all(accountId, season),
    /** Create a mini-league with its owner as the first member. Returns it. */
    addMinileague: (name, season, ownerId) => {
      for (;;) {
        const code = newCode();
        if (q.minileagueByCode.get(code)) continue;
        const id = Number(q.addMinileague.run(code, name.trim(), season, ownerId, Date.now()).lastInsertRowid);
        q.join.run(id, ownerId, Date.now());
        return q.minileague.get(id);
      }
    },
    members: (leagueId) => new Set(q.members.all(leagueId).map((r) => r.account_id)),
    isMember: (leagueId, accountId) => Boolean(q.isMember.get(leagueId, accountId)),
    join: (leagueId, accountId) => q.join.run(leagueId, accountId, Date.now()),
    leave: (leagueId, accountId) => q.leave.run(leagueId, accountId),

    marketStamp: (season, week) => q.marketStamp.get(season, week) ?? null,
    market: (season, week) => {
      const row = q.market.get(season, week);
      return row && { players: JSON.parse(row.players_json), provisional: Boolean(row.provisional), updatedAt: row.updated_at };
    },
    saveMarket: (season, week, players, { provisional = false } = {}) => q.saveMarket.run(season, week, JSON.stringify(players), provisional ? 1 : 0, Date.now()),

    scoresStamp: (season, week) => q.scoresStamp.get(season, week) ?? null,
    scores: (season, week) => {
      const row = q.scores.get(season, week);
      return row && { scores: JSON.parse(row.scores_json), final: Boolean(row.final), updatedAt: row.updated_at };
    },
    saveScores: (season, week, scores, { final = false } = {}) => q.saveScores.run(season, week, JSON.stringify(scores), final ? 1 : 0, Date.now()),

    calendar: (season) => {
      const row = q.calendar.get(season);
      return row && { games: JSON.parse(row.games_json), updatedAt: row.updated_at };
    },
    saveCalendar: (season, games) => q.saveCalendar.run(season, JSON.stringify(games), Date.now()),
  };
}

export const nameKey = (name) => name.trim().toLowerCase().replace(/\s+/g, ' ');

// No 0/O or 1/I, so codes are easy to read out.
const newCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('');

export function hashSecret(secret) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(String(secret), salt, 32).toString('hex')}`;
}

export function checkSecret(secret, stored) {
  const [salt, hash] = stored.split(':');
  const given = scryptSync(String(secret), salt, 32);
  return timingSafeEqual(given, Buffer.from(hash, 'hex'));
}
