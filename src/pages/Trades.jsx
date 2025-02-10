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
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const { squad, removePlayer, clearSquad } = useSquad();
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
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        maxWidth: '1300px',
        width: '100%'
      }}>
        <h1 style={{ color: '#013369' }}>Manage Players</h1>
        <button
          onClick={() => setShowResetConfirm(true)}
          style={{
            padding: '8px 16px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 'bold'
          }}
        >
          Reset Squad
        </button>
      </div>
      
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

      {showResetConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            <h3 style={{ color: '#013369', marginBottom: '20px' }}>
              Reset Squad?
            </h3>
            <p style={{ marginBottom: '20px', color: '#666' }}>
              This will remove all players from your roster and starting lineup. This action cannot be undone.
            </p>
            <div style={{
              display: 'flex',
              gap: '15px',
              justifyContent: 'center'
            }}>
              <button
                onClick={() => {
                  clearSquad();
                  setShowResetConfirm(false);
                }}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 'bold'
                }}
              >
                Reset
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'white',
                  color: '#666',
                  border: '1px solid #ccc',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 'bold'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Trades;
