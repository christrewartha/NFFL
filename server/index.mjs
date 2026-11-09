// NFFL league server: serves the built app and a small JSON API.
// Usage: npm run build && node server/index.mjs   (PORT, DB_PATH env vars optional)

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSecret, openStore } from './store.mjs';
import { createGame } from './game.mjs';
import { applyChanges } from '../src/core/squad.js';
import { weekLocks } from '../src/core/league.js';
import { fetchWeekResults } from '../src/core/results.js';

const PORT = Number(process.env.PORT ?? 8787);
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const store = openStore(process.env.DB_PATH ?? join(ROOT, 'server', 'nffl.db'));
const game = createGame(store);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// --- Helpers -------------------------------------------------------------------
async function body(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10_000) throw new HttpError(413, 'Request too large');
  }
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new HttpError(400, 'Bad JSON');
  }
}

function send(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
}

const nflResults = new Map();

// A few sign-in attempts per IP per 10 minutes, so passwords can't be brute-forced.
const attempts = new Map();
function rateLimit(ip) {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  if (recent.length >= 10) throw new HttpError(429, 'Too many attempts. Try again in a few minutes.');
  attempts.set(ip, [...recent, now]);
}

function auth(req) {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  const id = token && store.login(token);
  const account = id && store.account(id);
  if (!account) throw new HttpError(401, 'Please sign in again');
  return { account, token };
}

/** The signed-in account, its team brought up to date, and the season's clock. */
function context(req) {
  const { account, token } = auth(req);
  if (!game.isReady()) throw new HttpError(503, 'The league is starting up. Try again in a minute.');
  const c = game.clock();
  return { account, token, c, team: game.teamOf(account.id, c) };
}

function credentials({ name, password }) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 24) throw new HttpError(400, 'Pick a name (up to 24 characters)');
  if (typeof password !== 'string' || password.length < 6 || password.length > 100) throw new HttpError(400, 'Passwords need at least 6 characters');
  return { name: name.trim(), password };
}

function leagueName(name) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 30) throw new HttpError(400, 'Give the league a name (up to 30 characters)');
  return name.trim();
}

const myLeagues = (account) => store.minileaguesOf(account.id, game.season)
  .map((l) => ({ id: l.id, code: l.code, name: l.name, size: l.size, isOwner: l.owner_id === account.id }));

/**
 * A team's scored week for the table. With `locks` (a rival's live week), players whose
 * game hasn't kicked off are hidden, armband and all: picks are revealed as games lock.
 * Once the last game has kicked off, everything shows (players on a bye never lock).
 */
function shownWeek(result, team, locks) {
  const hidden = (id) => locks?.next != null && id && !locks.teams.has(team.info[id]?.team);
  return {
    week: result.week,
    rows: result.rows.map((r) => (hidden(r.id)
      ? { slot: r.slot, id: null, name: null, hidden: true, pts: 0, mult: 1, bonus: 0 }
      : { ...r, name: team.info[r.id]?.name ?? null, pos: team.info[r.id]?.pos ?? null })),
    hits: result.hits,
    chip: result.chip,
    chipPts: result.chipPts,
  };
}

/**
 * Every team's table row: weekly totals, the live week if one is in play, and `prevTotal`,
 * the total before the latest week (the one in play, else the last processed), for movement.
 */
function allTeams(account, c) {
  const locks = c.open ? weekLocks(game.schedule(), c.open) : null;
  const inPlay = c.open && c.weeks[c.open - 1].locked ? c.open : null;
  const latestWeek = inPlay ?? c.weeks.filter((w) => w.complete && !w.preLeague).at(-1)?.week ?? null;
  return store.teams(game.season).map((t) => {
    const team = game.teamOf(t.accountId, c, t.team);
    const weekly = game.results(team, c);
    const live = game.liveResult(team, c);
    const isMe = t.accountId === account.id;
    const shown = live ?? weekly.at(-1);
    const total = weekly.reduce((s, r) => s + r.total, 0) + (live?.total ?? 0);
    const latestPts = live?.week === latestWeek ? live.total : weekly.find((r) => r.week === latestWeek)?.total ?? 0;
    return {
      id: t.accountId,
      name: t.name,
      isMe,
      weekly: weekly.map((r) => ({ week: r.week, total: r.total })),
      live: live && { week: live.week, total: live.total },
      total,
      prevTotal: latestWeek ? total - latestPts : null,
      latest: shown && shownWeek(shown, team, live && !isMe ? locks : null),
    };
  });
}

/** Rows sorted by total, with rank and prevRank (equal totals share a rank). */
function ranked(rows) {
  const rankBy = (key, row) => (row[key] == null ? null : 1 + rows.filter((r) => r[key] > row[key]).length);
  return rows
    .map((r) => ({ ...r, rank: rankBy('total', r), prevRank: rankBy('prevTotal', r) }))
    .sort((a, b) => b.total - a.total);
}

// --- API -----------------------------------------------------------------------
const routes = {
  'POST /api/signup': async (req) => {
    rateLimit(req.socket.remoteAddress);
    const { name, password } = credentials(await body(req));
    if (store.accountByName(name)) throw new HttpError(409, 'That name is taken. Sign in instead, or pick another.');
    return { token: store.newLogin(store.addAccount(name, password)) };
  },

  'POST /api/login': async (req) => {
    rateLimit(req.socket.remoteAddress);
    const { name, password } = await body(req);
    const account = typeof name === 'string' && store.accountByName(name);
    if (!account || typeof password !== 'string' || !checkSecret(password, account.password_hash)) throw new HttpError(401, "That name and password don't match");
    return { token: store.newLogin(account.id) };
  },

  'POST /api/logout': async (req) => {
    store.dropLogin(auth(req).token);
    return { ok: true };
  },

  'GET /api/state': async (req) => {
    const { account, c, team } = context(req);
    return {
      game: { season: game.season, startWeek: game.startWeek },
      me: { id: account.id, name: account.name },
      leagues: myLeagues(account),
      weeks: c.weeks,
      week: c.open,
      market: { season: game.season, week: c.open, players: c.open ? game.market(c.open).players : [] },
      schedule: game.schedule(),
      team,
    };
  },

  // Save a batch of changes the manager has reviewed and confirmed. All or nothing.
  'POST /api/commit': async (req) => {
    const { account, c, team } = context(req);
    if (!c.open) throw new HttpError(409, 'The season is over');
    const { squad, captain = null, vice = null, chip = null } = await body(req);
    const ids = Array.isArray(squad) ? squad.filter((id) => typeof id === 'string') : null;
    if (!ids || ids.length !== squad.length || new Set(ids).size !== ids.length || ids.length > 15) throw new HttpError(400, 'Bad squad');
    if ([captain, vice].some((id) => id != null && typeof id !== 'string')) throw new HttpError(400, 'Bad armband');
    if (chip != null && typeof chip !== 'string') throw new HttpError(400, 'Bad chip');
    let next;
    try {
      next = applyChanges(team, { squad: ids, captain, vice, chip }, game.market(c.open).byId, { locks: weekLocks(game.schedule(), c.open) });
    } catch (e) {
      throw new HttpError(400, e.message);
    }
    store.saveTeam(account.id, game.season, next);
    return { team: next };
  },

  // Player scores for a week that has kicked off: live until it's processed, then final.
  'GET /api/scores': async (req, url) => {
    const { c } = context(req);
    const week = Number(url.searchParams.get('week'));
    if (!c.weeks[week - 1]?.locked || week < game.startWeek) throw new HttpError(403, "That week hasn't kicked off yet");
    return game.scores(week)?.scores ?? {};
  },

  // Real NFL final scores for solo play's game log. ESPN refuses browser requests from
  // other sites, so fetch them here and cache them (finished games never change).
  'GET /api/nfl-results': async (req, url) => {
    const season = Number(url.searchParams.get('season'));
    const week = Number(url.searchParams.get('week'));
    if (!Number.isInteger(season) || season < 2000 || season > 2100 || !Number.isInteger(week) || week < 1 || week > 22) {
      throw new HttpError(400, 'Bad season or week');
    }
    const key = `${season}:${week}`;
    const cached = nflResults.get(key);
    if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached.results;
    const results = await fetchWeekResults(season, week);
    nflResults.set(key, { results, at: Date.now() });
    return results;
  },

  // A table: the overall one (every team) or one of your mini-leagues (?league=id).
  // Totals include the week in play, provisionally.
  'GET /api/standings': async (req, url) => {
    const { account, c } = context(req);
    const leagueId = url.searchParams.get('league');
    const league = leagueId ? store.minileague(Number(leagueId)) : null;
    if (leagueId && (!league || !store.isMember(league.id, account.id))) throw new HttpError(404, "You're not in that league");
    const members = league && store.members(league.id);
    const standings = ranked(allTeams(account, c).filter((t) => !members || members.has(t.id)));
    return { league: league && { id: league.id, code: league.code, name: league.name }, standings };
  },

  // Your rank in the overall table and each of your mini-leagues, and where you were
  // before the latest week (the one in play, else the last one processed).
  'GET /api/leagues/summary': async (req) => {
    const { account, c } = context(req);
    const all = allTeams(account, c);
    const mine = (rows) => {
      const me = ranked(rows).find((r) => r.isMe);
      return { size: rows.length, rank: me?.rank ?? null, prevRank: me?.prevRank ?? null };
    };
    return {
      overall: mine(all),
      leagues: myLeagues(account).map((l) => {
        const members = store.members(l.id);
        return { id: l.id, name: l.name, ...mine(all.filter((t) => members.has(t.id))) };
      }),
    };
  },

  'POST /api/leagues': async (req) => {
    const { account } = context(req);
    const name = leagueName((await body(req)).name);
    if (store.minileaguesOf(account.id, game.season).length >= 20) throw new HttpError(400, "That's the most leagues you can be in");
    const league = store.addMinileague(name, game.season, account.id);
    return { league: { id: league.id, code: league.code, name: league.name }, leagues: myLeagues(account) };
  },

  'POST /api/leagues/join': async (req) => {
    rateLimit(req.socket.remoteAddress);
    const { account } = context(req);
    const { code } = await body(req);
    const league = typeof code === 'string' && store.minileagueByCode(code.trim().toUpperCase());
    if (!league || league.season !== game.season) throw new HttpError(404, 'No league with that code');
    store.join(league.id, account.id);
    return { league: { id: league.id, code: league.code, name: league.name }, leagues: myLeagues(account) };
  },

  'POST /api/leagues/leave': async (req) => {
    const { account } = context(req);
    store.leave(Number((await body(req)).id), account.id);
    return { leagues: myLeagues(account) };
  },
};

// --- Static files ----------------------------------------------------------------
async function serveStatic(res, pathname) {
  const file = normalize(join(DIST, decodeURIComponent(pathname)));
  const inDist = file.startsWith(DIST);
  try {
    if (!inDist || pathname.endsWith('/')) throw new Error('not a file');
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
    res.end(data);
  } catch {
    // Single-page app: unknown paths get the app shell.
    const html = await readFile(join(DIST, 'index.html'));
    res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-cache' });
    res.end(html);
  }
}

// --- The season ------------------------------------------------------------------
// Calendar, prices, live scores and each week's processing all happen in game.tick().
game.tick();
setInterval(game.tick, 30 * 1000);

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) {
      const route = routes[`${req.method} ${url.pathname}`];
      if (!route) throw new HttpError(404, 'Not found');
      send(res, 200, await route(req, url));
    } else if (url.pathname === '/') {
      res.writeHead(302, { location: `/league${url.search}` });
      res.end();
    } else {
      await serveStatic(res, url.pathname);
    }
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    send(res, e.status ?? 500, { error: e instanceof HttpError ? e.message : 'Something went wrong' });
  }
}).listen(PORT, () => console.log(`NFFL server on http://localhost:${PORT}`));
