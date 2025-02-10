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
  const { starters, bench } = squad;

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

  const positionOrder = ['QB', 'RB1', 'RB2', 'WR1', 'WR2', 'TE', 'FLEX', 'K', 'D/ST'];
  const benchSlots = Math.max(5, bench.length + 1);

  return (
    <div style={commonStyles.pageContainer}>
      <Header />
      <h1 style={{ color: '#013369', marginBottom: '30px' }}>Trade Players</h1>
      
      {/* Starters section */}
      <div style={{
        ...commonStyles.card,
        marginBottom: '20px',
        maxWidth: '1200px'
      }}>
        <h2 style={{ color: '#013369', marginBottom: '20px' }}>Current Starters</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '20px',
          justifyItems: 'center',
          width: '100%',
          '@media (max-width: 1200px)': {
            gridTemplateColumns: 'repeat(3, 1fr)',
          },
          '@media (max-width: 900px)': {
            gridTemplateColumns: 'repeat(2, 1fr)',
          },
          '@media (max-width: 600px)': {
            gridTemplateColumns: '1fr',
          },
        }}>
          {positionOrder.map((position) => (
            <div key={position} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              width: '200px'
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
                {position}
              </div>
              {starters[position] ? (
                <PlayerCard 
                  player={starters[position]} 
                  onClick={handlePlayerClick}
                />
              ) : (
                <div 
                  onClick={() => handleEmptySlotClick(position)}
                  style={{
                    width: '200px',
                    height: '200px',
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

      {/* Bench section */}
      <div style={{
        ...commonStyles.card,
        marginBottom: '20px',
        maxWidth: '1200px'
      }}>
        <h2 style={{ color: '#013369', marginBottom: '20px' }}>Bench</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '20px',
          justifyItems: 'center',
          width: '100%',
          '@media (max-width: 1200px)': {
            gridTemplateColumns: 'repeat(3, 1fr)',
          },
          '@media (max-width: 900px)': {
            gridTemplateColumns: 'repeat(2, 1fr)',
          },
          '@media (max-width: 600px)': {
            gridTemplateColumns: '1fr',
          },
        }}>
          {[...Array(benchSlots)].map((_, index) => (
            <div key={`bench-${index}`} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              width: '200px'
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
                BENCH {index + 1}
              </div>
              {bench[index] ? (
                <PlayerCard 
                  player={bench[index]} 
                  onClick={handlePlayerClick}
                />
              ) : (
                <div 
                  onClick={() => handleEmptySlotClick('BENCH')}
                  style={{
                    width: '200px',
                    height: '200px',
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
