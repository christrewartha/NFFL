import { useEffect, useState } from 'react';

const STEPS = ['Locking teams', 'Scoring the week', 'Updating prices', 'Opening the next week'];

/** Shown while a week is processed after its deadline. The app reloads itself when it's back. */
export default function UpdatingView({ league, updating }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15 * 1000);
    return () => clearInterval(timer);
  }, []);

  const back = new Date(updating.reopens).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const minutes = Math.max(0, Math.ceil((updating.reopens - now) / 60000));
  // Steps tick off as the window runs down.
  const progress = (now - updating.deadline) / Math.max(1, updating.reopens - updating.deadline);
  const done = Math.min(STEPS.length - 1, Math.max(0, Math.floor(progress * STEPS.length)));

  return (
    <div className="updating">
      <div className="updating-spinner" aria-hidden="true" />
      <h2>Updating</h2>
      <p>The Week {updating.week} deadline has passed. {league.name} is offline while the week is processed.</p>
      <ul className="updating-steps">
        {STEPS.map((s, i) => (
          <li key={s} className={i < done ? 'done' : i === done ? 'active' : ''}>{s}</li>
        ))}
      </ul>
      <p className="updating-back">
        Back at <strong>{back}</strong>{minutes > 0 && <span className="muted"> · in {minutes} min</span>}
      </p>
      <p className="muted small">This page will refresh itself.</p>
    </div>
  );
}
