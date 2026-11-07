// Game rules in one place so they're easy to tweak while the format is being designed.
// Money is held in tenths of a million (45 = £4.5m) to avoid float drift.

export const RULES = {
  budget: 1000,
  // 15-man squad, FPL-sized. Everyone plays: no bench, so no dead money and no
  // handcuff lottery. (The engine still supports a bench and FLEX if we want them back.)
  squad: { QB: 2, RB: 4, WR: 5, TE: 2, K: 1, DEF: 1 },
  starterSlots: ['QB', 'QB', 'RB', 'RB', 'RB', 'RB', 'WR', 'WR', 'WR', 'WR', 'WR', 'TE', 'TE', 'K', 'DEF'],
  benchSize: 0,
  maxPerTeam: 3,
  freeTransfersPerWeek: 2,
  maxBankedTransfers: 5,
  hitCost: 4,
  // Share of a price rise you keep when selling (FPL: half).
  keepProfitShare: 0.5,
  captainMultiplier: 2,
  // QBs out-project everyone almost every week, which would make captaincy automatic.
  noCaptain: ['QB'],
  // Kickers and defences cost nothing and can be swapped without using a transfer,
  // so they're a free weekly pick rather than a drain on budget and transfers.
  freePositions: ['K', 'DEF'],
  scoring: 'pts_ppr',
  // Chips: each can be played once a season, one per week, and can't be undone.
  tripleCaptainMultiplier: 3,
  paydirtTdPts: 6, // extra per rushing, receiving or defensive TD
  eatTheWBonus: 3, // per player who plays in a win
};

export const CHIPS = [
  { id: 'freeHit', name: 'Free Hit', blurb: 'Unlimited free transfers for one week. After the deadline your squad goes back to how it was at the start of the week.' },
  { id: 'tripleCaptain', name: 'Triple Captain', blurb: `Your captain scores ×${RULES.tripleCaptainMultiplier} instead of ×${RULES.captainMultiplier}.` },
  { id: 'paydirt', name: 'Paydirt', blurb: `Rushing, receiving and defensive TDs score double (+${RULES.paydirtTdPts} each). Passing TDs don't count.` },
  { id: 'eatTheW', name: 'Eat the W', blurb: `+${RULES.eatTheWBonus} for every player who plays in a win.` },
];
export const chipName = (id) => CHIPS.find((c) => c.id === id)?.name ?? id;

const SCORING_NAMES = { pts_ppr: 'PPR', pts_half_ppr: 'Half PPR', pts_std: 'Standard' };
export const scoringName = () => SCORING_NAMES[RULES.scoring] ?? RULES.scoring;

export const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

export const SLOT_ELIGIBLE = {
  QB: ['QB'],
  RB: ['RB'],
  WR: ['WR'],
  TE: ['TE'],
  FLEX: ['RB', 'WR', 'TE'],
  K: ['K'],
  DEF: ['DEF'],
};

export const fitsSlot = (pos, slot) => SLOT_ELIGIBLE[slot].includes(pos);

export const fmtPrice = (tenths) => `£${(tenths / 10).toFixed(1)}m`;
export const fmtPts = (pts) => (pts == null ? '-' : (Math.round(pts * 10) / 10).toFixed(1));
