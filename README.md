# NFFL

A mock-up of fantasy NFL played the FPL way. You get a budget, buy a 15-player squad, and change it through the season with limited free transfers. There's no draft and no league-mates competing for players.

## Running

```sh
npm install
npm run dev      # http://localhost:5173 (also exposed on your LAN)
npm test         # core logic tests
npm run build    # static build in dist/
```

## Rules (draft, all in `src/core/rules.js`)

- **Budget:** £100m.
- **Squad:** 15 players: 2 QB, 4 RB, 5 WR, 2 TE, 1 K, 1 DEF.
- **Free picks:** the kicker and defence cost nothing, and swapping them doesn't use a transfer, so you can pick a new one every week (`freePositions`).
- **Lineup:** no bench. All 15 play every week. So there's no value in stashing backups, and the choice moves to the squad itself (e.g. two solid QBs, or one megastar and a cheap second). A player on a bye scores zero, so bye weeks work like FPL blank gameweeks. The engine still supports a bench and FLEX: set `starterSlots` and `benchSize`.
- **Team limit:** at most 3 players from one NFL team.
- **Scoring:** half PPR. The captain scores double, and the vice takes over if the captain doesn't play.
- **Captaincy:** QBs can't be captain or vice. They out-project everyone almost every week (57 of the top 80 weekly projections in weeks 1–8 of 2026), which would make the choice automatic. Armbands go to your two priciest eligible players until you pick your own.
- **Autosubs** (only if a bench is configured): a starter who doesn't play is replaced by the first eligible bench player, in bench order.
- **Transfers:** unlimited until your first deadline. After that you get 2 free per week, banking up to 5. Each extra transfer costs 4 points. Buying back a player you sold the same week doesn't count as a transfer.
- **Selling:** you keep half of any price rise, rounded down to £0.1m, and take all of any fall (the FPL rule).
- **Deadline:** 12:00 UTC on the day of the week's first game. Sleeper's schedule has dates but no kickoff times.

## Pricing (`src/core/pricing.js`)

Price is set from expected points per game, using three signals:

1. **Season-to-date ppg,** shrunk towards the preseason projection as if the projection were worth 3 games.
2. **Preseason projection,** which is used on its own until a player has games.
3. **Next week's projection** makes up 40% of the value. Bye weeks are skipped.

**Prices track quality, not availability.** A player listed Out/IR/Sus is priced on form alone until he's back, so injured stars don't crash and rebound. The projection shown in the app is still zeroed for those players (and quartered for Doubtful), because Sleeper's projections often ignore injury status.

**Weekly moves are capped** (`PRICE_MOVES`): up to £0.3m up and £0.1m down a week, so prices rise more easily than they fall, as in FPL. The replay and the online league use this. Solo play doesn't, because it keeps no record of last week's prices.

Each position has its own price band. The replacement-level player (e.g. RB48) gets the minimum price and the second-best player gets the maximum, with a straight line in between. Kickers and defences are priced at zero. The cheapest possible squad costs about £58.5m, which leaves about £41.5m for upgrades.

Prices are recalculated every time the app refreshes from Sleeper, at most every 30 minutes.

## The injury problem

Next week's projection is part of the price. So when a backup inherits the starting job, his price jumps as soon as projections update, and the free bargain disappears. The window between the news breaking and the next refresh plays the same role as FPL's price-change speculation.

Known gaps and ideas to explore:

- This only works if projections react quickly. Check how fast Sleeper's provider updates the backups after a starter is ruled out.
- Alternatives to try: FPL-style prices driven by ownership and transfer volume (needs a server and real users), a transfer lock after injury news, or "injury replacement" free transfers when a player goes on IR.

## Season replay

This replays a past season with a population of simulated managers, to test rule ideas against real data:

```sh
node scripts/fetch-season.mjs 2025              # cache the season in data/2025 (about 10 MB, ~40 requests)
node scripts/replay.mjs 2025 --managers 1000    # writes reports/replay-2025.md and .json
```

- `src/core/replay.js` rebuilds the priced market at each deadline from the cached data. It is pure, so it could later power an in-app "play a past season" mode.
- `scripts/replay.mjs` holds the manager strategies (active, stash, passive) and the rule variants. Add new variants to its `VARIANTS` list.

## Online league

The live NFL season, FPL style. Everyone signs up for an account with one team, and every team goes on the **overall table**. **Mini-leagues** are private tables for groups of friends, joined with an invite code or link. The server holds the calendar, prices and teams, checks every transfer, and scores the week live.

### Run it

```sh
npm install
npm run build      # the server serves the built app from dist/
npm start          # http://localhost:8787/league
```

On first start the server sets itself up: it asks Sleeper which season it is, loads the calendar from ESPN, and begins the league in the first week that hasn't kicked off yet. It prices that week and is ready in a few seconds. Admin commands: `npm run admin -- status`, `accounts`, `leagues`, `reset-password <name> <password>` and `start-week <n>` (before anyone has played a week).

- **Accounts:** a name and a password (6+ characters). There's no email, so forgotten passwords are reset with the admin command.
- **Mini-leagues:** anyone can create one from the Leagues tab, which gives a six-letter code and an invite link (`/league?join=CODE`). Someone who opens the link and signs up (or signs in) joins automatically.
- **Calendar:** kickoff times, game status and final scores come from ESPN's scoreboard. Refreshed twice a day, and every couple of minutes for a week whose games are on.
- **Rolling locks:** each player locks at his team's scheduled kickoff, by the server's clock (never by game state, which lags). A locked player can't be sold, bought or given an armband. The armband can move to any player whose game hasn't started; moving it off a captain who has played gives up his double. Chips must be played before the week's first kickoff. `applyChanges` enforces all of this with `weekLocks` (`src/core/league.js`), on the server and in the app's draft preview alike.
- **Weekly cycle:** a week opens when the previous one is processed, 8 hours after its last kickoff (normally Tuesday morning UK). Its prices are set then and stored, capped against last week's (`PRICE_MOVES`). Until the first kickoff, projections and injury news refresh every 3 hours without moving prices. While games are on the server polls Sleeper every 2 minutes and the Points and Leagues tabs show live, provisional points. At processing, final scores are stored, every team rolls over and the next week opens. Later stat corrections are ignored. The first week's prices are provisional if the league starts before the previous week is processed, and are set again (once) when it is.
- **Leagues tab:** opens on a list of your leagues (Overall first) with your rank and an arrow for how it moved in the latest week: the week in play, else the last one processed. Tap one for its full table, which has an arrow on every row.
- **Rivals' teams** are revealed player by player as each game kicks off, and in full once the last game has (players on a bye never lock).
- **Joining late:** a new team gets a free squad-building week, starting in the open week, and all four chips.
- **Changes are drafted, then confirmed.** Transfers and armband changes stay in a local draft. Nothing reaches the server until the manager reviews and confirms them: out/in at their prices, free transfers used, points cost and bank before/after. The server applies the batch all-or-nothing with the same `applyChanges` the preview uses, and refuses a half-finished transfer. Solo play works the same way.
- **Game logs** come straight from Sleeper, as in solo play.
- **Storage:** one SQLite file, `server/nffl.db`, using Node's built-in `node:sqlite` (Node 24). See *Backups* below. The `leagues`, `managers` and `sessions` tables are left over from the 2022 replay trial and aren't used.
- **Dev:** `npm run dev` proxies `/api` to a local server, so `http://localhost:5173/league` works for UI work.

### Backups

`npm run backup` copies the database into `backups/` as `nffl-YYYYMMDD-HHMMSS.db`. It uses SQLite's online backup, so the server keeps running and the copy is consistent even mid-write. Each copy is integrity-checked, and copies older than 14 days are deleted (`--keep N` to change, `--dir` for another folder).

**Run it nightly** with `crontab -e`:

```
30 3 * * * cd $HOME/NFFL && /usr/bin/node server/backup.mjs >> backups/backup.log 2>&1
```

**Copy backups off the machine** so a dead drive doesn't take them too. [rclone](https://rclone.org) works with Google Drive, OneDrive, Dropbox and others:

1. `sudo apt install rclone`, then `rclone config`: choose *New remote*, call it `cloud`, and pick your provider.
2. When it asks *Use web browser to automatically authenticate?*, answer **n**. It will tell you to run `rclone authorize "<provider>"` on a computer with a browser (install rclone on your PC for this). Paste the token it gives you back into the server.
3. Extend the cron line so each backup is uploaded after it's made:

```
30 3 * * * cd $HOME/NFFL && /usr/bin/node server/backup.mjs >> backups/backup.log 2>&1 && /usr/bin/rclone copy backups cloud:nffl-backups --include "nffl-*.db" >> backups/backup.log 2>&1
```

`rclone copy` never deletes, so the cloud folder keeps every backup. Each one is tiny.

**Restore** a backup:

```sh
sudo systemctl stop nffl
cp server/nffl.db server/nffl.db.before-restore      # just in case
rm -f server/nffl.db-wal server/nffl.db-shm
cp backups/nffl-20261107-033000.db server/nffl.db
sudo systemctl start nffl
```

### Automatic deploys

Once set up, anything pushed to `main` on GitHub goes live on the server within about 2 minutes. The server checks GitHub every 2 minutes using its read-only deploy key, so nothing extra is exposed to the internet. Each deploy (`scripts/deploy.sh`):

1. Backs up the database.
2. Pulls the new commit, reinstalls packages if `package.json`/`package-lock.json` changed, runs the tests and builds. The old version keeps serving meanwhile.
3. Restarts the server only if that all passed, then checks it responds.
4. If any step fails, puts the previous version back. A failed commit isn't retried. The next push gets a fresh attempt.

Local edits on the server are kept. If one clashes with an incoming change, the deploy stops and tells you.

**Set up once** on the server (after a manual `git pull` to fetch the scripts):

```sh
cd ~/NFFL && sudo scripts/install-deploy.sh
```

This adds a systemd timer (`nffl-deploy`) that runs the deploy as your user, plus a sudo rule letting it restart the `nffl` service and nothing else.

- **Watch deploys:** `journalctl -u nffl-deploy -f`
- **Next check:** `systemctl list-timers nffl-deploy`
- **Deploy now:** `sudo systemctl start nffl-deploy`
- **Pause:** `sudo systemctl stop nffl-deploy.timer` (`start` to resume)
- **Check it end to end:** push any small change and watch the log for `[deploy] Deployed …` within about 2 minutes.

### Hosting it from home

The server is one Node process on port 8787. To reach it from outside on a home connection with a changing IP:

**Option A: Cloudflare Tunnel (easiest).** Free, with no port forwarding, no dynamic DNS and automatic HTTPS. It needs your domain's DNS moved to Cloudflare (the free plan is fine). Install `cloudflared`, then:

```sh
cloudflared tunnel login
cloudflared tunnel create nffl
cloudflared tunnel route dns nffl nffl.your.domain
cloudflared tunnel run --url http://localhost:8787 nffl   # or `cloudflared service install` to run at boot
```

**Option B: fully self-managed.**

- **Port forwarding:** forward port 443 on the router to the PC. A Virgin Media Hub can do this in router mode.
- **Dynamic DNS:** keep the domain pointing at your IP. Most registrars offer an update URL you can call on a schedule.
- **HTTPS:** put [Caddy](https://caddyserver.com) in front. `caddy reverse-proxy --from nffl.your.domain --to localhost:8787` fetches certificates automatically.

**Keeping it running.** On Windows, a Task Scheduler task "At startup" running `node server\index.mjs` in this folder is enough. Use [NSSM](https://nssm.cc) if you want it as a proper service.

## Project layout

```
src/core/        Pure JS, no React. Unit-tested in core.test.js.
  rules.js       game rules and formatting
  pricing.js     expected value, price bands, sell price
  gameweeks.js   deadlines, open week, byes (from the schedule)
  squad.js       squad building, lineup swaps, transfers, rollover, scoring and autosubs
  replay.js      past-season markets for the replay
  league.js      online league calendar and rolling locks
  sleeper.js     Sleeper API fetch and market build
  storage.js     localStorage behind a tiny interface
src/components/  React UI: Team (pitch), Transfers (market), Points, Leagues, Rules
src/App.jsx      solo play against live Sleeper data
src/LeagueApp.jsx online league (/league), talking to the server
server/          league server: index.mjs (HTTP + API), game.mjs, store.mjs (SQLite), admin.mjs (CLI)
```

## Data

Players come from [Sleeper](https://sleeper.com)'s public API. No account or key is needed.

- **Endpoints:** state, schedule, season projections, season-to-date stats, next week's projections, and weekly stats for scoring.
- **Unofficial:** apart from `/v1/state`, these endpoints aren't documented and could change.
- **Storage:** your team is saved in the browser's localStorage. Scores for finished weeks are cached there too.
