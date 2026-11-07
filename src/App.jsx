import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchMarket, fetchPlayerLog, fetchWeekScores } from './core/sleeper.js';
import { load, save } from './core/storage.js';
import { weekInfo } from './core/gameweeks.js';
import { autoLineup, newTeam, normalizeTeam, rollover, swap } from './core/squad.js';
import { RULES, fmtPrice } from './core/rules.js';
import TeamView from './components/TeamView.jsx';
import MarketView from './components/MarketView.jsx';
import PointsView from './components/PointsView.jsx';
import RulesView from './components/RulesView.jsx';
import Shell, { TABS } from './components/Shell.jsx';
import { DraftBar } from './components/DraftBar.jsx';
import { useDraft } from './components/useDraft.js';
import { SeasonContext } from './components/season.js';
import { weekWinners, withResults, withWins } from './core/results.js';

const STALE_MS = 30 * 60 * 1000;

// Real final scores, through the league server (ESPN won't answer browsers directly).
async function fetchNflResults(season, week) {
  const res = await fetch(`/api/nfl-results?season=${season}&week=${week}`);
  if (!res.ok) throw new Error(`Results for week ${week} unavailable`);
  return res.json();
}


export default function App() {
  const [market, setMarket] = useState(() => load('market'));
  const [team, setTeam] = useState(() => load('team'));
  const [tab, setTab] = useState('team');
  const [marketFilter, setMarketFilter] = useState('ALL');
  const [status, setStatus] = useState({ loading: false, error: null });

  const refresh = useCallback(async () => {
    setStatus({ loading: true, error: null });
    try {
      const m = await fetchMarket();
      setMarket(m);
      save('market', m);
      setStatus({ loading: false, error: null });
    } catch (e) {
      setStatus({ loading: false, error: e.message });
    }
  }, []);

  useEffect(() => {
    if (!market || Date.now() - market.syncedAt > STALE_MS) refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fit the saved team to the current rules, then lock any weeks whose deadline
  // passed since the app was last opened.
  useEffect(() => {
    if (!market || !team || team.season !== market.season) return;
    const projOf = new Map(market.players.map((p) => [p.id, p.weekProj ?? 0]));
    const week = market.week ?? weekInfo(market.schedule).length + 1;
    const next = rollover(normalizeTeam(team, (id) => projOf.get(id) ?? 0), week);
    if (next !== team) setTeam(next);
  }, [market, team]);

  useEffect(() => save('team', team), [team]);

  const weeks = useMemo(() => (market ? weekInfo(market.schedule) : []), [market]);
  const playersById = useMemo(() => new Map((market?.players ?? []).map((p) => [p.id, p])), [market]);
  // Final scores for finished weeks, cached on the device once fetched (they never change).
  const [results, setResults] = useState([]);
  useEffect(() => {
    if (!market) return undefined;
    let live = true;
    const done = weekInfo(market.schedule).filter((w) => w.complete).map((w) => w.week);
    Promise.all(done.map(async (week) => {
      const key = `results:${market.season}:${week}`;
      const rows = load(key) ?? await fetchNflResults(market.season, week).then((r) => (save(key, r), r));
      return rows.map((r) => ({ week, ...r }));
    }))
      .then((weeks) => live && setResults(weeks.flat()))
      .catch(() => {}); // Scores are a nice-to-have; the game log works without them.
    return () => { live = false; };
  }, [market]);

  const season = useMemo(() => ({
    schedule: withResults(market?.schedule ?? [], results),
    week: market?.week ?? null,
    getLog: (p) => fetchPlayerLog(market.season, p.id),
  }), [market, results]);

  const startTeam = () => setTeam(newTeam(market.season, market.week));
  // Transfers and armbands are drafted, then confirmed. Bench moves (if a bench is configured) apply directly.
  const draftState = useDraft(team, playersById, async (intent, draft) => setTeam(draft));
  const { draft } = draftState;
  const actions = {
    ...draftState.actions,
    swap: (a, b) => setTeam((t) => swap(t, a, b)),
    autoLineup: (scoreOf) => setTeam((t) => autoLineup(t, scoreOf)),
  };
  // Scores for a week, cached once all its games are final, and marked with who won
  // (for Eat the W) from the final scores loaded above.
  const getScores = useCallback(async (week, final) => {
    const key = `scores:${RULES.scoring}:${market.season}:${week}`;
    let scores = final && load(key);
    if (!scores) {
      scores = await fetchWeekScores(market.season, week);
      if (final) save(key, scores);
    }
    return withWins(scores, weekWinners(results, week));
  }, [market?.season, results]);
  const openMarket = (filter = 'ALL') => {
    setMarketFilter(filter);
    setTab('market');
  };

  let body;
  if (!market) {
    body = (
      <div className="empty-state">
        {status.error ? <p className="error">Couldn't reach Sleeper: {status.error}</p> : <p>Loading players from Sleeper…</p>}
        {status.error && <button className="primary" onClick={refresh}>Try again</button>}
      </div>
    );
  } else if (market.week == null && !team) {
    body = <div className="empty-state"><p>The {market.season} regular season is over. Come back next year.</p></div>;
  } else if (!team || team.season !== market.season) {
    body = (
      <div className="empty-state">
        <h2>Pick your squad</h2>
        <p>
          {fmtPrice(RULES.budget)} to spend on 15 players. Transfers are unlimited and free until the
          Week {market.week} deadline.
        </p>
        <button className="primary" onClick={startTeam}>Start a new team</button>
      </div>
    );
  } else if (tab === 'team') {
    body = <TeamView team={draft} saved={draftState.base} actions={actions} playersById={playersById} weeks={weeks} openMarket={openMarket} />;
  } else if (tab === 'market') {
    body = <MarketView team={draft} actions={actions} market={market} playersById={playersById} filter={marketFilter} setFilter={setMarketFilter} />;
  } else if (tab === 'points') {
    body = <PointsView team={team} weeks={weeks} getScores={getScores} />;
  }
  if (tab === 'rules') {
    body = (
      <RulesView>
        <h3 className="section">Data</h3>
        <p className="muted small">
          {market ? `${market.players.length} players, ${market.season} season, synced ${new Date(market.syncedAt).toLocaleString()}.` : 'Not loaded.'}
        </p>
        <div className="row-actions">
          <button onClick={refresh} disabled={status.loading}>{status.loading ? 'Refreshing…' : 'Refresh from Sleeper'}</button>
          {team && (
            <button className="danger" onClick={() => window.confirm('Delete your team and start again?') && setTeam(null)}>
              Reset team
            </button>
          )}
        </div>
      </RulesView>
    );
  }

  const notice = market && (
    <>
      {status.loading && <div className="muted small">Refreshing from Sleeper…</div>}
      {status.error && <div className="error small">Refresh failed: {status.error}</div>}
      {draftState.notice && <div className="error small">{draftState.notice}</div>}
    </>
  );
  return (
    <Shell subtitle="Fantasy NFL, FPL-style" notice={notice} tabs={TABS} tab={tab} setTab={setTab}>
      <SeasonContext.Provider value={season}>{body}</SeasonContext.Provider>
      {team && team.season === market?.season && <DraftBar draftState={draftState} />}
    </Shell>
  );
}
