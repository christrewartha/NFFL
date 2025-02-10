import { createContext, useContext, useState } from 'react';

const SquadContext = createContext(null);

export function SquadProvider({ children }) {
  // Full roster with all slots
  const [roster, setRoster] = useState({
    QB1: { id: '2558125', name: 'Patrick Mahomes', team: 'KC', number: '15', position: 'QB' },
    QB2: { id: '2563722', name: 'Joe Burrow', team: 'CIN', number: '9', position: 'QB' },
    RB1: { id: '2557997', name: 'Christian McCaffrey', team: 'SF', number: '23', position: 'RB' },
    RB2: { id: '2560968', name: 'Saquon Barkley', team: 'NYG', number: '26', position: 'RB' },
    RB3: { id: '2561021', name: 'Nick Chubb', team: 'CLE', number: '24', position: 'RB' },
    WR1: { id: '2564556', name: 'Justin Jefferson', team: 'MIN', number: '18', position: 'WR' },
    WR2: { id: '2565941', name: "Ja'Marr Chase", team: 'CIN', number: '1', position: 'WR' },
    WR3: { id: '2566409', name: 'DeVonta Smith', team: 'PHI', number: '6', position: 'WR' },
    TE1: { id: '2540258', name: 'Travis Kelce', team: 'KC', number: '87', position: 'TE' },
    TE2: { id: '2558266', name: 'George Kittle', team: 'SF', number: '85', position: 'TE' },
    K: { id: '2536340', name: 'Justin Tucker', team: 'BAL', number: '9', position: 'K' },
    'D/ST': { id: '100025', name: 'Philadelphia', team: 'PHI', number: '', position: 'D/ST' },
  });

  // Starting lineup configuration
  const [starters, setStarters] = useState({
    QB: roster.QB1,
    RB1: roster.RB1,
    RB2: roster.RB2,
    WR1: roster.WR1,
    WR2: roster.WR2,
    TE: roster.TE1,
    FLEX: roster.RB3,
    K: roster.K,
    'D/ST': roster['D/ST'],
  });

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

  const replacePlayer = (oldPlayer, newPlayer) => {
    // Replace in roster
    setRoster(prev => {
      const newRoster = { ...prev };
      Object.entries(newRoster).forEach(([key, value]) => {
        if (value?.id === oldPlayer.id) {
          newRoster[key] = newPlayer;
        }
      });
      return newRoster;
    });

    // Replace in starters if present
    setStarters(prev => {
      const newStarters = { ...prev };
      Object.entries(newStarters).forEach(([key, value]) => {
        if (value?.id === oldPlayer.id) {
          newStarters[key] = newPlayer;
        }
      });
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