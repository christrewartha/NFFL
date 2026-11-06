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
  scoring: 'pts_half_ppr',
};

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
