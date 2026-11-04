import PlayerAvatar from './PlayerAvatar.jsx';
import { fmtPrice, fmtPts } from '../core/rules.js';

/** Bottom sheet with a player's numbers and whatever actions the caller passes in. */
export default function PlayerSheet({ player, sellFor, actions = [], onClose }) {
  if (!player) return null;
  const stats = [
    ['Price', player.price != null ? fmtPrice(player.price) : '-'],
    sellFor != null && ['Sells for', fmtPrice(sellFor)],
    ['Next week', player.opponent === 'BYE' ? 'Bye' : `${fmtPts(player.weekProj)} proj${player.opponent ? ` v ${player.opponent}` : ''}`],
    ['Season', player.gp ? `${fmtPts(player.seasonPts)} pts in ${player.gp} gm (${fmtPts(player.seasonPpg)}/gm)` : 'No games yet'],
    ['Preseason proj', player.projPpg != null ? `${fmtPts(player.projPpg)}/gm` : '-'],
    player.snapPct != null && ['Snap share', `${player.snapPct}%`],
    ['Value (pricing)', `${fmtPts(player.value)} pts/gm`],
  ].filter(Boolean);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <PlayerAvatar player={player} size={64} />
          <div>
            <div className="sheet-name">{player.name}</div>
            <div className="muted">
              <span className={`pos-tag pos-${player.pos}`}>{player.pos}</span> {player.team}
            </div>
            {player.injury && (
              <div className="error small">
                {player.injury.status}{player.injury.part ? ` (${player.injury.part})` : ''}
              </div>
            )}
          </div>
        </div>
        <dl className="sheet-stats">
          {stats.map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        <div className="sheet-actions">
          {actions.map((a) => (
            <button key={a.label} className={a.primary ? 'primary' : a.danger ? 'danger' : ''} disabled={a.disabled} onClick={a.onClick}>
              {a.label}
            </button>
          ))}
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
