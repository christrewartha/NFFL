import { useCallback, useEffect, useMemo, useState } from 'react';
import { load, save } from './core/storage.js';
import { fetchPlayerLog } from './core/sleeper.js';
import { weekLocks } from './core/league.js';
import TeamView from './components/TeamView.jsx';
import MarketView from './components/MarketView.jsx';
import PointsView from './components/PointsView.jsx';
import RulesView from './components/RulesView.jsx';
import Shell, { TABS } from './components/Shell.jsx';
import AuthView from './components/AuthView.jsx';
import LeagueView from './components/LeagueView.jsx';
import { DraftBar } from './components/DraftBar.jsx';
import { useDraft } from './components/useDraft.js';
import { SeasonContext } from './components/season.js';

const LEAGUE_TABS = [...TABS.slice(0, 3), { id: 'league', label: 'Leagues', icon: '🏆' }, TABS[3]];

/** The current time, ticking every `ms`, so locks appear as games kick off. */
function useNow(ms) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}

/** Online league: the server owns the season, prices and teams; this is just the UI. */
export default function LeagueApp() {
  const [token, setToken] = useState(() => load('session'));
  const [state, setState] = useState(null);
  const [tab, setTab] = useState('team');
  const [marketFilter, setMarketFilter] = useState('ALL');
  const [leagueId, setLeagueId] = useState(null);
  const [error, setError] = useState(null);
  // A mini-league invite (/league?join=CODE), kept until the manager has signed in.
  const [joining, setJoining] = useState(() => new URLSearchParams(window.location.search).get('join')?.toUpperCase() ?? load('join'));
  const now = useNow(30 * 1000);

  const api = useCallback(async (path, { method = 'GET', body } = {}) => {
    const res = await fetch(path, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body && { 'content-type': 'application/json' }) },
      body: body && JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) setToken(null);
    if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
    return data;
  }, [token]);

  useEffect(() => save('session', token), [token]);
  useEffect(() => {
    save('join', joining);
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
  }, [joining]);

  const refresh = useCallback(() => {
    if (!token) return;
    api('/api/state').then((s) => { setState(s); setError(null); }, (e) => setError(e.message));
  }, [api, token]);

  // Load on sign-in and when the app comes back to the foreground.
  useEffect(() => {
    refresh();
    const onFocus = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, [refresh]);

  // Reload when the week is processed and the next one opens. If that moment has already
  // passed, the server is a little behind this device's clock, so check again shortly.
  useEffect(() => {
    const at = state?.weeks?.find((w) => !w.complete)?.processAt;
    if (!at) return undefined;
    const wait = at > Date.now() ? at - Date.now() + 5000 : 60 * 1000;
    const timer = setTimeout(refresh, Math.min(wait, 2 ** 31 - 1));
    return () => clearTimeout(timer);
  }, [state, refresh]);

  // Join the league from an invite link once signed in.
  useEffect(() => {
    if (!joining || !state) return;
    api('/api/leagues/join', { method: 'POST', body: { code: joining } }).then(
      ({ league, leagues }) => {
        setState((s) => ({ ...s, leagues }));
        setLeagueId(league.id);
        setTab('league');
      },
      (e) => setError(`Couldn't join league ${joining}: ${e.message}`),
    );
    setJoining(null);
  }, [joining, state, api]);

  // Players whose game has kicked off this week (rechecked every 30 seconds).
  const minute = Math.floor(now / 30000);
  const locks = useMemo(
    () => (state?.week ? weekLocks(state.schedule, state.week, minute * 30000) : undefined),
    [state?.schedule, state?.week, minute], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const getScores = useCallback((week) => api(`/api/scores?week=${week}`), [api]);
  const playersById = useMemo(() => new Map((state?.market?.players ?? []).map((p) => [p.id, p])), [state]);
  const season = useMemo(() => ({
    schedule: state?.schedule ?? [],
    week: state?.week ?? null,
    getLog: (p) => fetchPlayerLog(state.game.season, p.id),
  }), [state?.schedule, state?.week, state?.game?.season]); // eslint-disable-line react-hooks/exhaustive-deps

  // Edits stay in this draft until the manager reviews and confirms them.
  const draftState = useDraft(state?.team ?? null, playersById, async (intent) => {
    const { team } = await api('/api/commit', { method: 'POST', body: intent });
    setState((s) => ({ ...s, team }));
  }, locks);
  const { draft, actions } = draftState;

  if (!token) return <Shell subtitle="League"><AuthView onSignedIn={setToken} joining={joining} /></Shell>;

  const openMarket = (filter = 'ALL') => {
    setMarketFilter(filter);
    setTab('market');
  };
  const signOut = () => {
    api('/api/logout', { method: 'POST' }).catch(() => {});
    setToken(null);
    setState(null);
  };

  let body;
  if (!state) {
    body = (
      <div className="empty-state">
        {error ? <p className="error">{error}</p> : <p>Loading…</p>}
        {error && <button className="primary" onClick={refresh}>Try again</button>}
      </div>
    );
  } else if (tab === 'league') {
    body = (
      <LeagueView
        api={api}
        leagues={state.leagues}
        setLeagues={(leagues) => setState((s) => ({ ...s, leagues }))}
        leagueId={leagueId}
        setLeagueId={setLeagueId}
        live={Boolean(locks?.chips)}
      />
    );
  } else if (tab === 'rules') {
    body = (
      <RulesView league>
        <h3 className="section">You</h3>
        <p className="muted small">Signed in as {state.me.name}, playing the {state.game.season} season (the league began in Week {state.game.startWeek}).</p>
        <div className="row-actions"><button onClick={signOut}>Sign out</button></div>
      </RulesView>
    );
  } else if (!state.week || tab === 'points') {
    body = <PointsView team={state.team} weeks={state.weeks} getScores={getScores} locks={locks} />;
  } else if (tab === 'team') {
    body = <TeamView team={draft} saved={draftState.base} actions={actions} playersById={playersById} weeks={state.weeks} openMarket={openMarket} locks={locks} />;
  } else {
    body = <MarketView team={draft} actions={actions} market={state.market} playersById={playersById} filter={marketFilter} setFilter={setMarketFilter} locks={locks} />;
  }

  const notice = (
    <>
      {state && <div className="muted small">{state.game.season} season · {state.week ? `Week ${state.week}` : 'finished'}</div>}
      {error && state && <div className="error small">{error}</div>}
      {draftState.notice && <div className="error small">{draftState.notice}</div>}
    </>
  );
  return (
    <Shell subtitle="League" notice={notice} tabs={LEAGUE_TABS} tab={tab} setTab={setTab}>
      <SeasonContext.Provider value={season}>{body}</SeasonContext.Provider>
      {state?.week && <DraftBar draftState={draftState} />}
    </Shell>
  );
}
