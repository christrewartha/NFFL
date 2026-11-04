import { useState } from 'react';
import { headshotUrl } from '../core/sleeper.js';

const initials = (name) =>
  name
    .split(' ')
    .filter((w) => /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('');

export default function PlayerAvatar({ player, size = 40 }) {
  const url = headshotUrl(player);
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, fontSize: size * 0.36 };

  if (!url || failed) {
    return (
      <span className={`avatar avatar-fallback pos-${player.pos}`} style={style} aria-hidden="true">
        {initials(player.name)}
      </span>
    );
  }
  return (
    <img
      className={`avatar ${player.pos === 'DEF' ? 'avatar-logo' : ''}`}
      style={style}
      src={url}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
