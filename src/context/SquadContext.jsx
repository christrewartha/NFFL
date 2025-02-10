import { createContext, useContext, useState } from 'react';

const SquadContext = createContext(null);

export function SquadProvider({ children }) {
  const [squad, setSquad] = useState({
    starters: {
        QB: { id: '2555334', name: 'Jared Goff', team: 'DET', number: '16', position: 'QB' },
        RB1: { id: '2556075', name: 'Derrick Henry', team: 'TEN', number: '22', position: 'RB' },
        RB2: { id: '2564148', name: 'Jonathan Taylor', team: 'IND', number: '28', position: 'RB' },
        WR1: { id: '2564556', name: 'Justin Jefferson', team: 'MIN', number: '18', position: 'WR' },
        WR2: { id: '2565941', name: "Ja'Marr Chase", team: 'CIN', number: '1', position: 'WR' },
        TE: { id: '2540258', name: 'Travis Kelce', team: 'KC', number: '87', position: 'TE' },
        FLEX: { id: '2559169', name: 'Austin Ekeler', team: 'LAC', number: '30', position: 'RB' },
        K: { id: '2536340', name: 'Justin Tucker', team: 'BAL', number: '9', position: 'K' },
        'D/ST': { id: '100029', name: 'San Francisco', team: 'SF', number: '', position: 'D/ST' },
    },
    bench: [
        { id: '2566163', name: 'Trevor Lawrence', team: 'JAX', number: '16', position: 'QB' },
        { id: '2557997', name: 'Christian McCaffrey', team: 'SF', number: '23', position: 'RB' },
        { id: '2566409', name: 'DeVonta Smith', team: 'PHI', number: '6', position: 'WR' },
        { id: '2558266', name: 'George Kittle', team: 'SF', number: '85', position: 'TE' },
    ]
  });

  const movePlayerToBench = (player, starterPosition) => {
    setSquad(prev => {
      const newSquad = { ...prev };
      // Remove from starters
      newSquad.starters[starterPosition] = null;
      // Add to bench
      newSquad.bench = [...prev.bench, player];
      return newSquad;
    });
  };

  const movePlayerToStarters = (player, benchIndex, starterPosition) => {
    setSquad(prev => {
      const newSquad = { ...prev };
      // Remove from bench
      newSquad.bench = prev.bench.filter((_, index) => index !== benchIndex);
      // Add to starters
      newSquad.starters[starterPosition] = player;
      return newSquad;
    });
  };

  const removePlayer = (player) => {
    setSquad(prev => {
      const newSquad = { ...prev };
      // Remove from starters if present
      Object.entries(newSquad.starters).forEach(([key, starter]) => {
        if (starter?.id === player.id) {
          newSquad.starters[key] = null;
        }
      });
      // Remove from bench if present
      newSquad.bench = prev.bench.filter(benchPlayer => benchPlayer?.id !== player.id);
      return newSquad;
    });
  };

  const replacePlayer = (oldPlayer, newPlayer) => {
    setSquad(prev => {
      const newSquad = { ...prev };
      // Replace in starters if present
      Object.entries(newSquad.starters).forEach(([key, starter]) => {
        if (starter?.id === oldPlayer.id) {
          newSquad.starters[key] = newPlayer;
        }
      });
      // Replace in bench if present
      newSquad.bench = prev.bench.map(benchPlayer => 
        benchPlayer?.id === oldPlayer.id ? newPlayer : benchPlayer
      );
      return newSquad;
    });
  };

  const value = {
    squad,
    movePlayerToBench,
    movePlayerToStarters,
    removePlayer,
    replacePlayer,
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