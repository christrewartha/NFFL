import { useEffect, useState } from 'react';
import { RULES, chipName, fmtPts } from '../core/rules.js';

const LIVE_REFRESH = 2 * 60 * 1000;

/** Load `path` from the API, again every couple of minutes while games are on. */
function useLive(api, path, live) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let current = true;
    const load = () => api(path).then(
      (d) => current && (setData(d), setError(null)),
      (e) => current && setError(e.message),
    );
    setData(null);
    load();
    const timer = live ? setInterval(load, LIVE_REFRESH) : null;
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [api, path, live]);
  return { data, error };
}

/**
 * The Leagues tab. First a list of the manager's leagues (the overall table and each
 * mini-league) with their rank and an arrow for how it moved in the latest week; tap one
 * for its full table. `leagueId`: null for the list, 'overall', or a mini-league's id.
 * While games are on, the live week counts and everything refreshes every couple of minutes.
 */
export default function LeagueView({ api, leagues, setLeagues, leagueId, setLeagueId, live }) {
  const league = leagues.find((l) => l.id === leagueId) ?? null;
  if (leagueId === 'overall' || league) {
    return <Table api={api} league={league} live={live} setLeagues={setLeagues} back={() => setLeagueId(null)} />;
  }
  return <LeagueList api={api} live={live} open={setLeagueId} setLeagues={setLeagues} />;
}

/** ▲ green if you've moved up, ▼ red if down, ● grey if the same; nothing before any points. */
function Movement({ rank, prevRank }) {
  if (rank == null || prevRank == null) return <span className="move" />;
  if (rank < prevRank) return <span className="move up" title={`Up from ${prevRank}`}>▲</span>;
  if (rank > prevRank) return <span className="move down" title={`Down from ${prevRank}`}>▼</span>;
  return <span className="move same" title="No change">●</span>;
}

function LeagueList({ api, live, open, setLeagues }) {
  const { data, error } = useLive(api, '/api/leagues/summary', live);
  const rows = data && [{ id: 'overall', name: 'Overall', ...data.overall }, ...data.leagues];
  return (
    <div>
      {error && <p className="error">{error}</p>}
      {!rows ? (
        !error && <p className="muted">Loading…</p>
      ) : (
        <table className="standings league-list">
          <thead><tr><th /><th>League</th><th className="num">Rank</th></tr></thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} onClick={() => open(l.id)}>
                <td><Movement rank={l.rank} prevRank={l.prevRank} /></td>
                <td>{l.name}</td>
                <td className="num">{l.rank ? <><strong>{l.rank}</strong><span className="muted small"> of {l.size}</span></> : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows?.some((l) => l.prevRank != null) && <p className="muted small">Arrows show how your rank moved in the latest week{live ? ' (live)' : ''}.</p>}
      <ManageLeagues api={api} setLeagues={setLeagues} setLeagueId={open} />
    </div>
  );
}

function Table({ api, league, live, setLeagues, back }) {
  const { data, error } = useLive(api, `/api/standings${league ? `?league=${league.id}` : ''}`, live);
  const [openId, setOpenId] = useState(null);
  const standings = data?.standings;
  const liveWeek = standings?.find((m) => m.live)?.live.week;
  const lastWeek = (m) => (liveWeek ? m.live : m.weekly.at(-1));

  return (
    <div>
      <div className="table-head">
        <button onClick={back}>‹ Leagues</button>
        <h3>{league?.name ?? 'Overall'}</h3>
      </div>

      {error && <p className="error">{error}</p>}
      {!standings ? (
        !error && <p className="muted">Loading…</p>
      ) : (
        <>
          <table className="standings">
            <thead>
              <tr><th>#</th><th>Manager</th><th className="num">{liveWeek ? `Wk ${liveWeek} live` : 'Last wk'}</th><th className="num">Total</th></tr>
            </thead>
            <tbody>
              {standings.map((m) => (
                <Row key={m.id} m={m} last={lastWeek(m)} open={openId === m.id} toggle={() => setOpenId(openId === m.id ? null : m.id)} />
              ))}
            </tbody>
          </table>
          {standings.every((m) => !m.weekly.length && !m.live) && <p className="muted small">Points appear once the first game kicks off.</p>}
        </>
      )}

      {league && <Invite league={league} api={api} setLeagues={setLeagues} onLeft={back} />}
    </div>
  );
}

function Row({ m, last, open, toggle }) {
  return (
    <>
      <tr className={m.isMe ? 'me' : ''} onClick={toggle}>
        <td className="rank"><Movement rank={m.rank} prevRank={m.prevRank} />{m.rank}</td>
        <td>{m.name}</td>
        <td className="num">{last ? fmtPts(last.total) : '-'}</td>
        <td className="num"><strong>{fmtPts(m.total)}</strong></td>
      </tr>
      {open && (
        <tr className="standings-detail">
          <td colSpan={4}>
            {m.latest ? <WeekDetail week={m.latest} live={Boolean(m.live)} /> : <span className="muted small">No points yet.</span>}
          </td>
        </tr>
      )}
    </>
  );
}

function WeekDetail({ week, live }) {
  const hidden = week.rows.filter((r) => r.hidden).length;
  return (
    <>
      <div className="muted small">
        Week {week.week}{live && ' (live)'}{week.chip && <span className="chip-tag">{chipName(week.chip)}</span>}
      </div>
      <table className="week-table">
        <tbody>
          {week.rows.filter((r) => !r.hidden).map((r, i) => (
            <tr key={i}>
              <td className="muted">{r.slot}</td>
              <td>
                {r.name ?? 'Empty'}
                {r.mult > 1 && <span className="armband inline">{r.mult > RULES.captainMultiplier ? `×${r.mult}` : 'C'}</span>}
                {r.bonus > 0 && <span className="chip-bonus">+{fmtPts(r.bonus)}</span>}
              </td>
              <td className="num">{fmtPts(r.pts)}</td>
            </tr>
          ))}
          {hidden > 0 && <tr><td /><td className="muted">{hidden} still to kick off (hidden until then)</td><td /></tr>}
          {week.chip && week.chip !== 'freeHit' && <tr><td /><td>{chipName(week.chip)}</td><td className="num ok">+{fmtPts(week.chipPts)}</td></tr>}
          {week.hits > 0 && <tr><td /><td className="error">Transfer hits</td><td className="num error">−{week.hits}</td></tr>}
        </tbody>
      </table>
    </>
  );
}

/** The selected mini-league's code and invite link, and leaving it. */
function Invite({ league, api, setLeagues, onLeft }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/league?join=${league.code}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      window.prompt('Copy this invite link', link);
    }
  };
  const leave = async () => {
    if (!window.confirm(`Leave ${league.name}? You can rejoin with the code ${league.code}.`)) return;
    const { leagues } = await api('/api/leagues/leave', { method: 'POST', body: { id: league.id } });
    setLeagues(leagues);
    onLeft();
  };
  return (
    <div className="notice">
      <strong>{league.name}</strong> · {league.size} {league.size === 1 ? 'member' : 'members'} · code <strong>{league.code}</strong>
      <div className="row-actions">
        <button className="primary" onClick={copy}>{copied ? 'Link copied' : 'Copy invite link'}</button>
        <button onClick={leave}>Leave</button>
      </div>
    </div>
  );
}

function ManageLeagues({ api, setLeagues, setLeagueId }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = (path, body) => async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { league, leagues } = await api(path, { method: 'POST', body });
      setLeagues(leagues);
      setLeagueId(league.id);
      setName('');
      setCode('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h3 className="section">Mini-leagues</h3>
      <form className="toolbar" onSubmit={run('/api/leagues/join', { code })}>
        <input placeholder="Invite code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" required />
        <button disabled={busy}>Join</button>
      </form>
      <form className="toolbar" onSubmit={run('/api/leagues', { name })}>
        <input placeholder="New league name" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} required />
        <button disabled={busy}>Create</button>
      </form>
      {error && <p className="error small">{error}</p>}
    </>
  );
}
