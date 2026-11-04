import { useCallback, useEffect, useMemo, useState } from 'react';
import { load, save } from './core/storage.js';
import TeamView from './components/TeamView.jsx';
import MarketView from './components/MarketView.jsx';
import PointsView from './components/PointsView.jsx';
import RulesView from './components/RulesView.jsx';
import Shell, { TABS } from './components/Shell.jsx';
import JoinView from './components/JoinView.jsx';
import LeagueView from './components/LeagueView.jsx';
import { DraftBar } from './components/DraftBar.jsx';
import { useDraft } from './components/useDraft.js';

const LEAGUE_TABS = [...TABS.slice(0, 3), { id: 'league', label: 'League', icon: '🏆' }, TABS[3]];

/** Online league: the server owns the season, prices and teams; this is just the UI. */
export default function LeagueApp() {
  const [token, setToken] = useState(() => load('session'));
  const [state, setState] = useState(null);
  const [tab, setTab] = useState('team');
  const [marketFilter, setMarketFilter] = useState('ALL');
  const [error, setError] = useState(null);

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

  const refresh = useCallback(() => {
    if (!token) return;
    api('/api/state').then(setState, (e) => setError(e.message));
  }, [api, token]);

  // Load on sign-in and when the app comes back to the foreground.
  useEffect(() => {
    refresh();
    const onFocus = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, [refresh]);

  // Reload just after the deadline so results and the new week appear.
  useEffect(() => {
    const next = state?.weeks.find((w) => !w.complete);
    if (!next) return;
    const timer = setTimeout(refresh, Math.min(next.deadline - Date.now() + 2000, 2 ** 31 - 1));
    return () => clearTimeout(timer);
  }, [state, refresh]);

  const getScores = useCallback((week) => api(`/api/scores?week=${week}`), [api]);
  const playersById = useMemo(() => new Map((state?.market.players ?? []).map((p) => [p.id, p])), [state]);

  // Edits stay in this draft until the manager reviews and confirms them.
  const draftState = useDraft(state?.team ?? null, playersById, async (intent) => {
    const { team } = await api('/api/commit', { method: 'POST', body: intent });
    setState((s) => ({ ...s, team }));
  });
  const { draft, actions } = draftState;

  if (!token) return <Shell subtitle="League"><JoinView onJoined={setToken} /></Shell>;

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
    body = <div className="empty-state">{error ? <p className="error">{error}</p> : <p>Loading…</p>}</div>;
  } else if (tab === 'league') {
    body = <LeagueView api={api} />;
  } else if (tab === 'rules') {
    body = (
      <RulesView league>
        <h3 className="section">You</h3>
        <p className="muted small">Signed in as {state.me.name} in {state.league.name} (code {state.league.code}), replaying the {state.league.season} season.</p>
        <div className="row-actions"><button onClick={signOut}>Sign out</button></div>
      </RulesView>
    );
  } else if (!state.week) {
    body = <PointsView team={state.team} weeks={state.weeks} getScores={getScores} />;
  } else if (tab === 'team') {
    body = <TeamView team={draft} actions={actions} playersById={playersById} weeks={state.weeks} openMarket={openMarket} />;
  } else if (tab === 'market') {
    body = <MarketView team={draft} actions={actions} market={state.market} playersById={playersById} filter={marketFilter} setFilter={setMarketFilter} />;
  } else {
    body = <PointsView team={state.team} weeks={state.weeks} getScores={getScores} />;
  }

  const notice = (
    <>
      {state && <div className="muted small">{state.league.name} · {state.league.season} season{state.week ? '' : ' · finished'}</div>}
      {error && state && <div className="error small">{error}</div>}
      {draftState.notice && <div className="error small">{draftState.notice}</div>}
    </>
  );
  return (
    <Shell subtitle="League" notice={notice} tabs={LEAGUE_TABS} tab={tab} setTab={setTab}>
      {body}
      {state?.week && <DraftBar draftState={draftState} />}
    </Shell>
  );
}
