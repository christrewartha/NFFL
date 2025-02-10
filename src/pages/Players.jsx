import { useNavigate, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import { useSquad } from '../context/SquadContext';
import { commonStyles } from '../styles/commonStyles';
import playerStats from '../data/player_stats.json';
import defaultHeadshot from '../assets/headshots/headshot_default.png';

function Players() {
  const navigate = useNavigate();
  const location = useLocation();
  const { squad, replacePlayer, money, teamCost } = useSquad();
  const { roster } = squad;
  const replacingPlayer = location.state?.replacingPlayer;

  const handlePlayerSelect = (player) => {
    console.log('Selecting player:', player);
    console.log('Replacing player:', replacingPlayer);
    
    if (!replacingPlayer) {
      console.log('No replacing player specified');
      return;
    }

    // Get the base position without numbers (e.g., "QB1" -> "QB")
    const targetPosition = replacingPlayer.position.replace(/\d+$/, '');
    console.log('Target position:', targetPosition);
    
    // Validate position match
    if (player.position !== targetPosition) {
      alert(`This slot requires a ${targetPosition} player`);
      return;
    }

    // Check if we can afford the player
    if (player.cost > (money - teamCost)) {
      alert(`Not enough budget for this player`);
      return;
    }

    // If we're clicking an empty slot, use the slotId directly
    if (replacingPlayer.slotId) {
      console.log('Using slot:', replacingPlayer.slotId);
      replacePlayer(replacingPlayer, player, replacingPlayer.slotId);
      navigate(-1);
      return;
    }

    // Otherwise find the slot in the roster that matches the position we're replacing
    const targetSlot = Object.entries(roster).find(
      ([slot, p]) => slot.startsWith(targetPosition) && p?.id === replacingPlayer.id
    )?.[0];

    console.log('Target slot:', targetSlot);

    if (targetSlot) {
      console.log('Replacing player in slot:', targetSlot);
      replacePlayer(replacingPlayer, player, targetSlot);
      navigate(-1);
    } else {
      console.error('Could not find target slot');
    }
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
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px'
      }}>
        <h1 style={{ color: '#013369' }}>
          Select {replacingPlayer ? replacingPlayer.position : ''} Player
        </h1>
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '10px 20px',
          borderRadius: '8px',
          border: '1px solid #e0e0e0',
          whiteSpace: 'nowrap'
        }}>
          <span style={{ color: '#666' }}>Budget: </span>
          <span style={{ 
            color: money - teamCost >= 0 ? '#28a745' : '#dc3545',
            fontWeight: 'bold'
          }}>
            ${money - teamCost}
          </span>
          <span style={{ color: '#666' }}> / ${money}</span>
        </div>
      </div>
      
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
            const canAfford = player.cost <= (money - teamCost);
            let playerHeadshot;
            try {
              playerHeadshot = new URL(`../assets/headshots/${player.id}.png`, import.meta.url).href;
            } catch {
              playerHeadshot = defaultHeadshot;
            }

            return (
              <div 
                key={player.id}
                onClick={() => !isInRoster && canAfford && handlePlayerSelect(player)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '15px',
                  borderRadius: '12px',
                  border: '1px solid #e0e0e0',
                  cursor: isInRoster || !canAfford ? 'default' : 'pointer',
                  transition: 'all 0.2s ease',
                  backgroundColor: isInRoster ? '#f8f9fa' : 'white',
                  opacity: isInRoster || !canAfford ? 0.6 : 1,
                  ':hover': (!isInRoster && canAfford) ? {
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
                    color: '#013369',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    {player.name}
                    <span style={{
                      backgroundColor: '#013369',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.9rem'
                    }}>
                      ${player.cost}
                    </span>
                    {isInRoster && <span style={{ 
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
                {!canAfford && !isInRoster && (
                  <div style={{
                    marginLeft: '10px',
                    color: '#dc3545',
                    fontSize: '0.9rem'
                  }}>
                    (Can't afford)
                  </div>
                )}
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