import { RULES, fmtPrice } from '../core/rules.js';
import { PRICE_BANDS, PRICE_MOVES, VALUE_WEIGHTS } from '../core/pricing.js';

/** The rules as currently configured. `league` switches to the replayed-season wording. */
export default function RulesView({ league = false, children }) {
  const squad = Object.entries(RULES.squad).map(([pos, n]) => `${n} ${pos}`).join(', ');
  return (
    <div className="rules">
      <h3 className="section">Rules (draft)</h3>
      <ul>
        <li><strong>Budget</strong> {fmtPrice(RULES.budget)} for a 15-player squad: {squad}.</li>
        <li>
          <strong>Lineup</strong>{' '}
          {RULES.benchSize ? `${RULES.starterSlots.join(', ')}, plus a bench of ${RULES.benchSize}.` : 'No bench: all 15 play every week.'}
        </li>
        <li><strong>Max {RULES.maxPerTeam}</strong> players from any one NFL team.</li>
        {RULES.freePositions.length > 0 && (
          <li><strong>Free picks</strong> {RULES.freePositions.join(' and ')} cost nothing, and swapping them doesn't use a transfer: pick a new one every week if you like.</li>
        )}
        <li><strong>Scoring</strong> Half PPR (Sleeper's {RULES.scoring}). Captain scores ×{RULES.captainMultiplier}; the vice takes over if the captain doesn't play.
          {RULES.noCaptain.length > 0 && ` ${RULES.noCaptain.join('s, ')}s can't be captain or vice.`}
        </li>
        {RULES.benchSize > 0 && (
          <li><strong>Autosubs</strong> A starter who doesn't play (bye, inactive) is replaced by the first eligible bench player who did, in bench order.</li>
        )}
        <li><strong>Transfers</strong> Unlimited and free until your first deadline. Then {RULES.freeTransfersPerWeek} free per week, banking up to {RULES.maxBankedTransfers}. Each extra costs {RULES.hitCost} pts.</li>
        <li><strong>Selling</strong> You keep {RULES.keepProfitShare === 0.5 ? 'half' : `${RULES.keepProfitShare * 100}%`} of any price rise (rounded down), and take the whole of any fall.</li>
        {league ? (
          <li><strong>Deadline</strong> One gameweek a day. At each deadline teams lock and the league goes offline for a while to process the week. When it's back, the week's points, the new prices and the next week are all ready.</li>
        ) : (
          <li><strong>Deadline</strong> 12:00 UTC on the day of each week's first game.</li>
        )}
      </ul>

      <h3 className="section">Pricing and the injury problem</h3>
      <p>
        Prices are recalculated {league ? 'each week' : 'every time data is refreshed'}, from expected points per game:
        season-to-date form (shrunk towards the preseason projection as if that were worth {VALUE_WEIGHTS.priorGames} games),
        blended {Math.round(VALUE_WEIGHTS.nextWeek * 100)}% with next week's projection. Prices track quality, not
        availability: a player listed Out/IR is priced on form alone until he's back, so injured stars don't crash.
        {league && ` A price can rise at most ${fmtPrice(PRICE_MOVES.maxRise)} and fall at most ${fmtPrice(PRICE_MOVES.maxFall)} a week.`}
      </p>
      <p>
        Because next week counts, a backup who inherits the starting job gets repriced as soon as projections update.
        There's still a window between the news and the refresh, which acts like FPL's price-rise speculation.
      </p>
      <table className="bands">
        <thead><tr><th>Pos</th><th>Min</th><th>Max</th><th>Min-priced from rank</th></tr></thead>
        <tbody>
          {Object.entries(PRICE_BANDS).map(([pos, b]) => (
            <tr key={pos}><td><span className={`pos-tag pos-${pos}`}>{pos}</span></td>{RULES.freePositions.includes(pos) ? <td colSpan={3}>Free</td> : <><td>{fmtPrice(b.min)}</td><td>{fmtPrice(b.max)}</td><td>{b.replacement}</td></>}</tr>
          ))}
        </tbody>
      </table>

      {children}
    </div>
  );
}
