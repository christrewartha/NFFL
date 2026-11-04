// NFFL league server: serves the built app and a small JSON API.
// Usage: npm run build && node server/index.mjs   (PORT, DB_PATH env vars optional)

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPin, openStore } from './store.mjs';
import { clock, currentTeam, results, seasonWeeks } from './game.mjs';
import { applyChanges } from '../src/core/squad.js';

const PORT = Number(process.env.PORT ?? 8787);
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const store = openStore(process.env.DB_PATH ?? join(ROOT, 'server', 'nffl.db'));

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

// A few join attempts per IP per 10 minutes, so PINs can't be brute-forced.
const attempts = new Map();
function rateLimit(ip) {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  if (recent.length >= 10) throw new HttpError(429, 'Too many attempts. Try again in a few minutes.');
  attempts.set(ip, [...recent, now]);
}

function auth(req) {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  const id = token && store.session(token);
  const manager = id && store.manager(id);
  if (!manager) throw new HttpError(401, 'Please sign in again');
  return { manager, league: store.league(manager.league_code), token };
}

/** Load the league's season and clock, and bring the manager's team up to date. */
async function context(manager, league) {
  const season = await seasonWeeks(league.season);
  const c = clock(league, season.length);
  const team = currentTeam(manager, league, c);
  if (JSON.stringify(team) !== JSON.stringify(manager.team)) store.saveTeam(manager.id, team);
  return { season, c, team };
}

// --- API -----------------------------------------------------------------------
const routes = {
  'POST /api/join': async (req) => {
    rateLimit(req.socket.remoteAddress);
    const { code, name, pin } = await body(req);
    const league = typeof code === 'string' && store.league(code.trim().toUpperCase());
    if (!league) throw new HttpError(404, 'No league with that code');
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 24) throw new HttpError(400, 'Pick a name (up to 24 characters)');
    if (!/^\d{4,8}$/.test(String(pin))) throw new HttpError(400, 'PIN must be 4 to 8 digits');
    const existing = store.managerByName(league.code, name);
    if (existing && !checkPin(pin, existing.pin_hash)) throw new HttpError(401, 'That name is taken and the PIN does not match');
    const id = existing?.id ?? store.addManager(league.code, name, pin);
    return { token: store.newSession(id) };
  },

  'POST /api/logout': async (req) => {
    store.dropSession(auth(req).token);
    return { ok: true };
  },

  'GET /api/state': async (req) => {
    const { manager, league } = auth(req);
    const { season, c, team } = await context(manager, league);
    return {
      league: { code: league.code, name: league.name, season: league.season },
      me: { id: manager.id, name: manager.name },
      weeks: c.weeks,
      week: c.open,
      market: { season: league.season, week: c.open, players: c.open ? season[c.open - 1].market : [] },
      team,
    };
  },

  // Save a batch of changes the manager has reviewed and confirmed. All or nothing.
  'POST /api/commit': async (req) => {
    const { manager, league } = auth(req);
    const { season, c, team } = await context(manager, league);
    if (!c.open) throw new HttpError(409, 'The season is over');
    const { squad, captain = null, vice = null } = await body(req);
    const ids = Array.isArray(squad) ? squad.filter((id) => typeof id === 'string') : null;
    if (!ids || ids.length !== squad.length || new Set(ids).size !== ids.length || ids.length > 15) throw new HttpError(400, 'Bad squad');
    if ([captain, vice].some((id) => id != null && typeof id !== 'string')) throw new HttpError(400, 'Bad armband');
    let next;
    try {
      next = applyChanges(team, { squad: ids, captain, vice }, season[c.open - 1].byId);
    } catch (e) {
      throw new HttpError(400, e.message);
    }
    store.saveTeam(manager.id, next);
    return { team: next };
  },

  'GET /api/scores': async (req, url) => {
    const { manager, league } = auth(req);
    const { season, c } = await context(manager, league);
    const week = Number(url.searchParams.get('week'));
    if (!c.weeks[week - 1]?.complete) throw new HttpError(403, "That week's deadline hasn't passed yet");
    return season[week - 1].scores;
  },

  'GET /api/league': async (req) => {
    const { manager: me, league } = auth(req);
    const season = await seasonWeeks(league.season);
    const standings = [];
    for (const m of store.managers(league.code)) {
      const { team } = await context(m, league);
      const weekly = results(team, season);
      const latest = weekly.at(-1);
      standings.push({
        id: m.id,
        name: m.name,
        isMe: m.id === me.id,
        weekly: weekly.map((r) => ({ week: r.week, total: r.total })),
        total: weekly.reduce((s, r) => s + r.total, 0),
        // Rivals' teams are only shown for locked weeks, as in FPL.
        latest: latest && {
          week: latest.week,
          rows: latest.rows.map((r) => ({ ...r, name: team.info[r.id]?.name ?? null, pos: team.info[r.id]?.pos ?? null })),
          hits: latest.hits,
        },
      });
    }
    return { standings: standings.sort((a, b) => b.total - a.total) };
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
