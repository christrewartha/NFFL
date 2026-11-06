// Player pricing. Prices track quality, not availability: next week's projection is part
// of the formula, so a backup who inherits a starting job rises, but a player who is out
// is priced on form alone, so injured stars don't crash and rebound. Weekly moves are
// capped, rising faster than falling (as FPL prices feel).

// Price band per position, in tenths (min = replacement level, max = elite).
export const PRICE_BANDS = {
  QB: { min: 50, max: 110, replacement: 24 },
  RB: { min: 45, max: 125, replacement: 48 },
  WR: { min: 45, max: 125, replacement: 60 },
  TE: { min: 40, max: 90, replacement: 20 },
  // Free positions (RULES.freePositions) are priced at zero.
  K: { min: 0, max: 0, replacement: 16 },
  DEF: { min: 0, max: 0, replacement: 16 },
};

// How much each signal counts towards expected points per game.
export const VALUE_WEIGHTS = {
  // Season-to-date form is shrunk towards the preseason projection as if the
  // projection were worth this many games.
  priorGames: 3,
  // Share of the value that comes from next week's projection (ignored on bye weeks).
  nextWeek: 0.4,
};

// Sleeper's weekly projections often ignore injury status, so scale them ourselves.
export const INJURY_FACTOR = { Out: 0, IR: 0, PUP: 0, Sus: 0, NA: 0, Doubtful: 0.25 };

export const isOut = (injuryStatus) => INJURY_FACTOR[injuryStatus] === 0;

export function adjustForInjury(weekProj, injuryStatus) {
  if (weekProj == null) return null;
  return weekProj * (INJURY_FACTOR[injuryStatus] ?? 1);
}

/**
 * Expected points per game from the three signals. Any may be null.
 * seasonPpg: actual ppg this season, gp: games played, projPpg: preseason projection ppg,
 * weekProj: next week's projection (null if on bye or no projection).
 */
export function expectedPpg({ seasonPpg, gp = 0, projPpg, weekProj }, weights = VALUE_WEIGHTS) {
  const prior = projPpg ?? seasonPpg ?? 0;
  const base = seasonPpg != null && gp > 0
    ? (gp * seasonPpg + weights.priorGames * prior) / (gp + weights.priorGames)
    : prior;
  if (weekProj == null) return base;
  return (1 - weights.nextWeek) * base + weights.nextWeek * weekProj;
}

/**
 * Set price on each player from their value. Linear between the replacement-level
 * player (min price) and the second-best player (max price, so one outlier doesn't
 * squash everyone else). Returns new player objects.
 */
export function assignPrices(players, bands = PRICE_BANDS) {
  const byPos = new Map();
  for (const p of players) {
    if (!byPos.has(p.pos)) byPos.set(p.pos, []);
    byPos.get(p.pos).push(p.value);
  }
  const anchors = new Map();
  for (const [pos, values] of byPos) {
    values.sort((a, b) => b - a);
    const band = bands[pos];
    const top = values[Math.min(1, values.length - 1)];
    const repl = values[Math.min(band.replacement - 1, values.length - 1)];
    anchors.set(pos, { top, repl });
  }
  return players.map((p) => {
    const band = bands[p.pos];
    const { top, repl } = anchors.get(p.pos);
    const t = top > repl ? Math.min(1, Math.max(0, (p.value - repl) / (top - repl))) : 0;
    return { ...p, price: Math.round(band.min + t * (band.max - band.min)) };
  });
}

// Most a price can move in a week, in tenths.
export const PRICE_MOVES = { maxRise: 3, maxFall: 1 };

/**
 * Damp prices towards last week's: each can rise at most maxRise and fall at most maxFall.
 * New players come in at their computed price.
 */
export function capPriceMoves(players, prevPriceById, { maxRise, maxFall } = PRICE_MOVES) {
  return players.map((p) => {
    const prev = prevPriceById.get(p.id);
    if (prev == null) return p;
    return { ...p, price: Math.min(prev + maxRise, Math.max(prev - maxFall, p.price)) };
  });
}

/**
 * You keep a share of any rise (rounded down to £0.1m), but take all of a fall.
 * FPL's share is half; 0 means you can never sell for a profit.
 */
export function sellPrice(buyPrice, currentPrice, keepShare = 0.5) {
  if (currentPrice <= buyPrice) return currentPrice;
  return buyPrice + Math.floor((currentPrice - buyPrice) * keepShare);
}
