import { createContext, useContext, useState, useEffect } from 'react';

const SquadContext = createContext(null);

const EMPTY_ROSTER = {
  QB1: null,
  QB2: null,
  RB1: null,
  RB2: null,
  RB3: null,
  WR1: null,
  WR2: null,
  WR3: null,
  TE1: null,
  TE2: null,
  K: null,
  'D/ST': null,
};

const EMPTY_STARTERS = {
  QB: null,
  RB1: null,
  RB2: null,
  WR1: null,
  WR2: null,
  TE: null,
  FLEX: null,
  K: null,
  'D/ST': null,
};

export function SquadProvider({ children }) {
  // Initialize state from localStorage or use empty roster
  const [roster, setRoster] = useState(() => {
    const savedRoster = localStorage.getItem('roster');
    return savedRoster ? JSON.parse(savedRoster) : EMPTY_ROSTER;
  });

  const [starters, setStarters] = useState(() => {
    const savedStarters = localStorage.getItem('starters');
    return savedStarters ? JSON.parse(savedStarters) : EMPTY_STARTERS;
  });

  // Save to localStorage whenever roster or starters change
  useEffect(() => {
    localStorage.setItem('roster', JSON.stringify(roster));
  }, [roster]);

  useEffect(() => {
    localStorage.setItem('starters', JSON.stringify(starters));
  }, [starters]);

  const removePlayer = (player) => {
    // Remove from roster
    setRoster(prev => {
      const newRoster = { ...prev };
      Object.entries(newRoster).forEach(([key, value]) => {
        if (value?.id === player.id) {
          newRoster[key] = null;
        }
      });
      return newRoster;
    });

    // Remove from starters if present
    setStarters(prev => {
      const newStarters = { ...prev };
      Object.entries(newStarters).forEach(([key, value]) => {
        if (value?.id === player.id) {
          newStarters[key] = null;
        }
      });
      return newStarters;
    });
  };

  const replacePlayer = (oldPlayer, newPlayer, targetSlot) => {
    // Add to roster
    setRoster(prev => ({
      ...prev,
      [targetSlot]: newPlayer
    }));

    // Try to place in starters if there's an empty slot
    setStarters(prev => {
      const newStarters = { ...prev };
      const position = newPlayer.position;  // Use the actual position, not the slot
      const flexEligible = ['RB', 'WR', 'TE'].includes(position);
      
      // Find an empty starter slot
      let starterSlot = null;
      switch (position) {
        case 'QB':
          if (!prev.QB) starterSlot = 'QB';
          break;
        case 'RB':
          if (!prev.RB1) starterSlot = 'RB1';
          else if (!prev.RB2) starterSlot = 'RB2';
          else if (!prev.FLEX && flexEligible) starterSlot = 'FLEX';
          break;
        case 'WR':
          if (!prev.WR1) starterSlot = 'WR1';
          else if (!prev.WR2) starterSlot = 'WR2';
          else if (!prev.FLEX && flexEligible) starterSlot = 'FLEX';
          break;
        case 'TE':
          if (!prev.TE) starterSlot = 'TE';
          else if (!prev.FLEX && flexEligible) starterSlot = 'FLEX';
          break;
        case 'K':
          if (!prev.K) starterSlot = 'K';
          break;
        case 'D/ST':
          if (!prev['D/ST']) starterSlot = 'D/ST';
          break;
      }

      // If we found an empty starter slot, use it
      if (starterSlot) {
        newStarters[starterSlot] = newPlayer;
      }

      return newStarters;
    });
  };

  const moveToStarters = (player, position) => {
    setStarters(prev => ({
      ...prev,
      [position]: player
    }));
  };

  const movePlayerToBench = (player, starterPosition) => {
    setStarters(prev => ({
      ...prev,
      [starterPosition]: null
    }));
  };

  // Helper function to get bench players (any rostered player not in starters)
  const getBenchPlayers = () => {
    const starterIds = new Set(
      Object.values(starters)
        .filter(player => player !== null)
        .map(player => player.id)
    );

    return Object.values(roster)
      .filter(player => player !== null && !starterIds.has(player.id));
  };

  // Add function to clear roster and starters
  const clearSquad = () => {
    setRoster(EMPTY_ROSTER);
    setStarters(EMPTY_STARTERS);
    localStorage.removeItem('roster');
    localStorage.removeItem('starters');
  };

  const value = {
    squad: {
      roster,
      starters,
      bench: getBenchPlayers()
    },
    removePlayer,
    replacePlayer,
    moveToStarters,
    movePlayerToBench,
    clearSquad,
  };

  return (
    <SquadContext.Provider value={value}>
      {children}
    </SquadContext.Provider>
  );
}

export function useSquad() {
  const context = useContext(SquadContext);
  if (!context) {
    throw new Error('useSquad must be used within a SquadProvider');
  }
  return context;
} 