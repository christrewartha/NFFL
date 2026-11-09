import { useState } from 'react';

/** Sign up or sign in. `joining` is a mini-league code from an invite link, if any. */
export default function AuthView({ onSignedIn, joining }) {
  const [mode, setMode] = useState('signup');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/${mode}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, password }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      onSignedIn(data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const signup = mode === 'signup';
  return (
    <form className="join" onSubmit={submit}>
      <div className="segmented">
        <button type="button" className={signup ? 'active' : ''} onClick={() => setMode('signup')}>New here</button>
        <button type="button" className={signup ? '' : 'active'} onClick={() => setMode('login')}>Sign in</button>
      </div>
      <h2>{signup ? 'Pick a team for the season' : 'Welcome back'}</h2>
      <p className="muted">
        {signup
          ? 'Everyone plays the real NFL season and goes on the overall table. Mini-leagues let you compare with friends.'
          : 'Use the name and password you signed up with.'}
      </p>
      {joining && <p className="notice">You've been invited to a mini-league (code {joining}). You'll join it once you're signed in.</p>}
      <label>Your name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoComplete="username" required /></label>
      <label>Password{signup && ' (at least 6 characters)'}
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={signup ? 6 : undefined} autoComplete={signup ? 'new-password' : 'current-password'} required />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={busy}>{busy ? 'One moment…' : signup ? 'Sign up' : 'Sign in'}</button>
    </form>
  );
}
