import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Header from '../components/Header';
import PlayerCard from '../components/PlayerCard';
import TradePlayerOverlay from '../components/TradePlayerOverlay';
import { commonStyles } from '../styles/commonStyles';

function Trades() {
  const navigate = useNavigate();
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const [squad, setSquad] = useState({
    starters: {
        QB: { id: '2504211', name: 'Tom Brady', team: 'TB', number: '12', position: 'QB' },
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

  const handlePlayerClick = (player) => {
    setSelectedPlayer(player);
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
    setSquad(prev => {
      const newSquad = { ...prev };
      
      // Remove from starters if present
      Object.entries(newSquad.starters).forEach(([key, player]) => {
        if (player?.name === selectedPlayer.name) {
          newSquad.starters[key] = null;
        }
      });
      
      // Remove from bench if present
      newSquad.bench = newSquad.bench.filter(
        player => player?.name !== selectedPlayer.name
      );
      
      return newSquad;
    });
    
    setSelectedPlayer(null);
  };

  const positionOrder = ['QB', 'RB1', 'RB2', 'WR1', 'WR2', 'TE', 'FLEX', 'K', 'D/ST'];
  const benchSlots = Math.max(5, squad.bench.length + 1);

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
          {positionOrder.map((pos) => (
            <div key={pos} style={{
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
                {pos}
              </div>
              {squad.starters[pos] ? (
                <PlayerCard 
                  player={squad.starters[pos]} 
                  onClick={handlePlayerClick}
                />
              ) : (
                <div style={{
                  width: '200px',
                  height: '200px',
                  border: '2px dashed #ccc',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#666'
                }}>
                  Empty Slot
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
              {squad.bench[index] ? (
                <PlayerCard 
                  player={squad.bench[index]} 
                  onClick={handlePlayerClick}
                />
              ) : (
                <div style={{
                  width: '200px',
                  height: '200px',
                  border: '2px dashed #ccc',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#666'
                }}>
                  Empty Slot
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
