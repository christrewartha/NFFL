import { useState } from 'react';

export default function JoinView({ onJoined }) {
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get('code') ?? '');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, name, pin }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      onJoined(data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="join" onSubmit={submit}>
      <h2>Join your league</h2>
      <p className="muted">New here? Pick a name and PIN. Coming back? Use the same name and PIN to sign in.</p>
      <label>League code<input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" required /></label>
      <label>Your name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} required /></label>
      <label>PIN (4–8 digits)<input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} inputMode="numeric" type="password" minLength={4} maxLength={8} required /></label>
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={busy}>{busy ? 'Joining…' : 'Join'}</button>
    </form>
  );
}
