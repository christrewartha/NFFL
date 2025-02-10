export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'D/ST';

export interface Player {
  id: string;
  name: string;
  team: string;
  number: string;
  position: Position;
}

export interface StartersState {
  QB: Player | null;
  RB1: Player | null;
  RB2: Player | null;
  WR1: Player | null;
  WR2: Player | null;
  TE: Player | null;
  FLEX: Player | null;
  K: Player | null;
  'D/ST': Player | null;
}

export interface SquadState {
  starters: StartersState;
  bench: (Player | null)[];
} 