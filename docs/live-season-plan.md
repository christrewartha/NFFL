# Live season plan

Goal: the usual fantasy league plays the rest of the real 2026 season in NFFL, starting
**Week 11**, then carries on into the playoffs.

## Key dates (2026 season, UK times)

| | First kickoff | Notes |
|---|---|---|
| Week 10 | Fri 13 Nov 01:15 (Thu night game) | Dry run with a private test league |
| **Week 11** | **Fri 20 Nov 01:15** | Go live. 6 teams on bye (ATL, CLE, GB, LAR, NE, SEA): a real Free Hit week |
| Week 18 | Sun 10 Jan | Regular season ends |
| Playoffs | mid-Jan to mid-Feb | Wild Card, Divisional, Conference, Super Bowl |

The current 2022 replay league runs one week a day, so it finishes around 23 Nov.

## Data sources

Both are free, unofficial and undocumented, so they could change without notice. Both
were checked against the 2026 season and the 2025 playoffs.

- **Sleeper.** Live player stats (`/stats/nfl/{season}/{week}`), which update during
  games, plus projections and injury status. Already used everywhere in the app.
- **ESPN scoreboard.** Kickoff times (`events[].date`), game state (`pre` / `in` / `post`)
  and final scores. Already used for results.
- **Playoffs.** Sleeper takes `season_type=post`. ESPN takes `seasontype=3`. Sleeper's
  playoff schedule has placeholder rows (`TBD`, `canceled`) that need filtering out.

## Phase 1: live league for Week 11 (one deadline a week)

The weekly cycle is as follows.

- **Tuesday morning: processing.** Final scores are taken from Sleeper and ESPN, then
  next week's prices are built (week-on-week caps as now), then the week opens.
- **Tuesday to Thursday: transfers open.** Prices stay fixed. Projections and injury news
  refresh every few hours without moving prices.
- **First kickoff: deadline.** Every team locks, as now. No mid-week exploits are
  possible because nothing can change after Thursday night.
- **Thursday to Monday: live points.** The server polls Sleeper every 2 to 5 minutes, but
  only while ESPN shows a game in progress. Clients read the server's cache.

The work involved:

1. **League type.** Add `live` alongside `replay`. Admin:
   `npm run admin -- create --name ... --live`.
2. **Market from live Sleeper data.** Reuse `buildMarket`, as the solo app's
   `fetchMarket` does. Store each week's market (prices) in the database so restarts and
   repricing don't move them. Price caps start from the first stored week.
3. **Calendar from ESPN.** The deadline is the first kickoff. Processing is a fixed time
   after the last game (Tuesday 09:00 UK, say). Refresh kickoff times daily.
4. **Live scoring.** Points tab shows the locked week live, marked provisional until
   processing. Stat corrections after processing are ignored.
5. **Joining mid-season.** Already works: a new manager gets a free squad-building week
   and all four chips.
6. **Dry run.** Run a test league through the real Week 10 (13 to 17 Nov), then fix
   anything before Week 11.

## Phase 2: rolling locks and captain switching (Weeks 12 to 13)

1. **Kickoff times on every fixture.** Each player locks at his team's **scheduled
   kickoff** (maybe a minute before), using the server's clock, never when the game state
   changes. Polling lag would leave a window after kickoff: the Aaron Rodgers case.
2. **Server-side checks in `applyChanges`.** Reject selling or buying a locked player,
   giving the armband to a locked player, or playing a chip after the week's first
   kickoff. The draft preview uses the same code, so the app and server agree.
3. **Captain switching (World Cup rule).** The armband can move to any unlocked player.
   Moving it away from a locked captain gives up his double. Keep the vice for people who
   don't log in.
4. **Show lock state.** Padlocks on the Team and Transfers screens. Rivals' players
   become visible as each one locks.
5. **Postponed or moved games.** The daily refresh picks up moved kickoffs. A delayed
   kickoff just locks early, which is safe.

## Phase 3: playoffs (by mid-January)

A finale in the style of World Cup fantasy's knockout stages: fewer teams, more transfers.

Agreed so far:

- **The max-per-team cap rises each round**, as World Cup fantasy does in the semis and
  final, for example 3, 4, 6, 8. Keep the 15-player squad. By the Super Bowl it needs 8
  from each team, so some backups will score little or nothing. That's accepted.
- **Unlimited transfers before the Wild Card round** (in effect a wildcard), then
  generous free transfers each round. A squad can still be left with players who aren't
  playing if you're unlucky. That's accepted too.

Suggested (from the 2022 and 2025 playoffs):

- **Keep the budget, but reprice each round among the teams still in.** As teams go
  out, the best possible squad gets *cheaper* at regular-season prices. By the Super Bowl
  £100m buys almost the best squad (£86m to £102m), so every team would be the same.
  Repricing among the teams still in keeps the best squad at about £130m to £150m every
  round, the same budget pressure as the regular season (about £146m to £149m). The
  backups you're forced to pick come from the position quotas and the team cap, not the
  budget. A bigger budget would only make squads more alike.
- **Give everyone the same budget for the playoff wildcard**, rather than carrying over
  team value. That way price-rise gains from the regular season don't decide the finale.

- **Probably a smaller squad.** The two Super Bowl teams have only about 16 players worth
  8+ ppg (NE/SEA in 2025, PHI/KC in 2022). A 15-player squad means picking nearly all of
  them. One option is a 9-player playoff lineup (QB, 2 RB, 2 WR, TE, FLEX, K, DEF). With a
  max of 3 per team that only needs raising for the Super Bowl (to about 6). The engine
  already supports FLEX and other lineup shapes. The rules would need to vary by phase,
  where today they're global.

Still to decide:

- **Exact caps and free transfers** for each round.
- **Wild Card byes.** The two top seeds sit out round 1 but are the likeliest to go deep.
  That's a good decision to leave in.
- **Standings.** A separate playoff table, an overall total, or both.
- **Chips.** A fresh set for the playoffs, or none.

## Rule changes on hold

These are for after the first test, or for its second half.

- **Hit cost −4 → −8.** A typical week is about 200 points, so −4 is only about 2% of a
  week (FPL's −4 is about 7%). At −4 nearly any upgrade is worth a hit. In the replay
  the change barely moves season totals, but it makes taking a hit a real decision.
- **TE premium: +0.5 per TE catch (1.5 PPR for TEs), with the TE price cap raised from
  £9.0m to about £10.5m.** The gap between top and mid-range TEs grows to match WRs.
  TE captaincy goes from about 1% to about 10% (2025), or 12% to 36% in a
  dominant-TE year (2022). +1 is too much: TEs captain 63% of the time in 2022. Points
  need to depend on position, because Sleeper has no TE-premium field. That touches
  replay, live scoring and pricing.
