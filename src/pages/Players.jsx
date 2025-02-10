import { useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import Header from '../components/Header';
import { useSquad } from '../context/SquadContext';
import { commonStyles } from '../styles/commonStyles';
import playerStats from '../data/player_stats.json';
import defaultHeadshot from '../assets/headshots/headshot_default.png';

function Players() {
  const navigate = useNavigate();
  const location = useLocation();
  const { squad, replacePlayer } = useSquad();
  const { roster } = squad;
  const replacingPlayer = location.state?.replacingPlayer;

  const handlePlayerSelect = (player) => {
    if (replacingPlayer) {
      // Get the base position without numbers (e.g., "QB1" -> "QB")
      const targetPosition = replacingPlayer.position.replace(/\d+$/, '');
      
      // Validate position match
      if (player.position !== targetPosition) {
        alert(`This slot requires a ${targetPosition} player`);
        return;
      }

      // Find the first empty slot for this position
      const emptySlot = Object.entries(roster).find(
        ([slot, p]) => slot.startsWith(targetPosition) && !p
      )?.[0];

      if (emptySlot) {
        replacePlayer(null, player, emptySlot);
      }
    }
    navigate(-1);
  };

  // Check if a player is already in the roster
  const isPlayerInRoster = (playerId) => {
    return Object.values(roster).some(player => player?.id === playerId);
  };

  // Filter players based on the position we're replacing
  const filteredPlayers = playerStats.filter(player => {
    if (!replacingPlayer) return true;
    return player.position === replacingPlayer.position.replace(/\d+/, '');
  });

  return (
    <div style={commonStyles.pageContainer}>
      <Header />
      <h1 style={{ color: '#013369', marginBottom: '30px' }}>
        Select {replacingPlayer ? replacingPlayer.position : ''} Player
      </h1>
      
      <div style={{
        ...commonStyles.card,
        marginBottom: '20px',
        maxWidth: '800px',
        padding: '20px'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '15px',
          width: '100%'
        }}>
          {filteredPlayers.map((player) => {
            const isInRoster = isPlayerInRoster(player.id);
            let playerHeadshot;
            try {
              playerHeadshot = new URL(`../assets/headshots/${player.id}.png`, import.meta.url).href;
            } catch {
              playerHeadshot = defaultHeadshot;
            }

            return (
              <div 
                key={player.id}
                onClick={() => !isInRoster && handlePlayerSelect(player)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '15px',
                  borderRadius: '12px',
                  border: '1px solid #e0e0e0',
                  cursor: isInRoster ? 'default' : 'pointer',
                  transition: 'all 0.2s ease',
                  backgroundColor: isInRoster ? '#f8f9fa' : 'white',
                  opacity: isInRoster ? 0.6 : 1,
                  ':hover': !isInRoster ? {
                    backgroundColor: '#f8f9fa',
                    borderColor: '#013369',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                  } : {}
                }}
              >
                <img 
                  src={playerHeadshot}
                  alt={`${player.name} headshot`}
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '30px',
                    objectFit: 'cover',
                    border: '2px solid #013369',
                    filter: isInRoster ? 'grayscale(100%)' : 'none'
                  }}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = defaultHeadshot;
                  }}
                />
                <div style={{ 
                  flex: 1,
                  marginLeft: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ 
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    color: '#013369'
                  }}>
                    {player.name}
                    {isInRoster && <span style={{ 
                      marginLeft: '10px',
                      fontSize: '0.8rem',
                      color: '#666',
                      fontWeight: 'normal'
                    }}>
                      (In Roster)
                    </span>}
                  </div>
                  <div style={{ 
                    fontSize: '0.9rem',
                    color: '#666',
                    display: 'flex',
                    gap: '10px'
                  }}>
                    <span>{player.team}</span>
                    <span>•</span>
                    <span>#{player.number}</span>
                    <span>•</span>
                    <span>{player.position}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button 
        onClick={() => navigate(-1)}
        style={{
          ...commonStyles.primaryButton,
          marginTop: '20px'
        }}
      >
        Back
      </button>
    </div>
  );
}

export default Players; 