import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Header from '../components/Header';
import PlayerCard from '../components/PlayerCard';
import TradePlayerOverlay from '../components/TradePlayerOverlay';
import { useSquad } from '../context/SquadContext';
import { commonStyles } from '../styles/commonStyles';

function Trades() {
  const navigate = useNavigate();
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const { squad, removePlayer } = useSquad();
  const { roster } = squad;

  const handlePlayerClick = (player) => {
    setSelectedPlayer(player);
  };

  const handleEmptySlotClick = (position) => {
    navigate('/players', { 
      state: { 
        replacingPlayer: { position } 
      }
    });
  };

  const handleReplace = () => {
    navigate('/players', { 
      state: { 
        replacingPlayer: selectedPlayer 
      }
    });
    setSelectedPlayer(null);
  };

  const handleRemove = () => {
    if (selectedPlayer) {
      removePlayer(selectedPlayer);
      setSelectedPlayer(null);
    }
  };

  const slots = [
    'QB1', 'QB2', 'RB1', 'RB2', 'RB3',
    'WR1', 'WR2', 'WR3', 'TE1', 'TE2',
    'K', 'D/ST'
  ];

  return (
    <div style={commonStyles.pageContainer}>
      <Header />
      <h1 style={{ color: '#013369', marginBottom: '30px' }}>Trades</h1>
      
      <div style={{
        ...commonStyles.card,
        marginBottom: '20px',
        maxWidth: '1300px',
        padding: '30px'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '20px',
          width: '100%',
          '@media (max-width: 1300px)': {
            gridTemplateColumns: 'repeat(4, 1fr)',
          },
          '@media (max-width: 1000px)': {
            gridTemplateColumns: 'repeat(3, 1fr)',
          },
          '@media (max-width: 800px)': {
            gridTemplateColumns: 'repeat(2, 1fr)',
          },
          '@media (max-width: 500px)': {
            gridTemplateColumns: '1fr',
          },
        }}>
          {slots.map((slot) => (
            <div key={slot} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              minWidth: '200px',
              maxWidth: '240px',
              margin: '0 auto'
            }}>
              <div style={{
                color: '#013369',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                backgroundColor: '#f8f9fa',
                padding: '5px 15px',
                borderRadius: '15px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                {slot}
              </div>
              {roster?.[slot] ? (
                <PlayerCard 
                  player={roster[slot]} 
                  onClick={handlePlayerClick}
                />
              ) : (
                <div 
                  onClick={() => handleEmptySlotClick(slot.replace(/\d+/, ''))}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    border: '2px dashed #ccc',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#666',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    ':hover': {
                      borderColor: '#013369',
                      color: '#013369',
                      backgroundColor: '#f8f9fa'
                    }
                  }}
                >
                  Add Player
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <button 
        onClick={() => navigate('/menu')}
        style={{
          ...commonStyles.primaryButton,
          marginTop: '20px'
        }}
      >
        Back to Menu
      </button>

      {selectedPlayer && (
        <TradePlayerOverlay
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
          onReplace={handleReplace}
          onRemove={handleRemove}
        />
      )}
    </div>
  );
}

export default Trades;
