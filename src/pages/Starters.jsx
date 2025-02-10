import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Header from '../components/Header';
import PlayerCard from '../components/PlayerCard';
import PlayerDetailOverlay from '../components/PlayerDetailOverlay';
import { useSquad } from '../context/SquadContext';
import { commonStyles } from '../styles/commonStyles';

function Starters() {
  const navigate = useNavigate();
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [isSelectedPlayerStarter, setIsSelectedPlayerStarter] = useState(false);
  
  const { squad, movePlayerToBench, movePlayerToStarters } = useSquad();
  const { starters, bench } = squad;

  const handlePlayerClick = (player, isStarter = false) => {
    setSelectedPlayer(player);
    setIsSelectedPlayerStarter(isStarter);
  };

  const handleSubstitute = () => {
    if (!selectedPlayer) return;

    if (isSelectedPlayerStarter) {
      // Find the position in starters
      const starterPosition = Object.entries(starters).find(
        ([_, player]) => player?.id === selectedPlayer.id
      )?.[0];

      if (starterPosition) {
        movePlayerToBench(selectedPlayer, starterPosition);
      }
    } else {
      // Find the bench index
      const benchIndex = bench.findIndex(player => player?.id === selectedPlayer.id);
      
      // Find an empty position that matches the player's position
      let targetPosition = null;
      
      if (selectedPlayer.position === 'RB') {
        if (!starters.RB1) targetPosition = 'RB1';
        else if (!starters.RB2) targetPosition = 'RB2';
        else if (!starters.FLEX) targetPosition = 'FLEX';
      } else if (selectedPlayer.position === 'WR') {
        if (!starters.WR1) targetPosition = 'WR1';
        else if (!starters.WR2) targetPosition = 'WR2';
        else if (!starters.FLEX) targetPosition = 'FLEX';
      } else if (selectedPlayer.position === 'TE') {
        if (!starters.TE) targetPosition = 'TE';
        else if (!starters.FLEX) targetPosition = 'FLEX';
      } else if (selectedPlayer.position === 'QB' && !starters.QB) {
        targetPosition = 'QB';
      } else if (selectedPlayer.position === 'K' && !starters.K) {
        targetPosition = 'K';
      } else if (selectedPlayer.position === 'D/ST' && !starters['D/ST']) {
        targetPosition = 'D/ST';
      }

      if (targetPosition && benchIndex !== -1) {
        movePlayerToStarters(selectedPlayer, benchIndex, targetPosition);
      }
    }

    setSelectedPlayer(null);
  };

  const positionOrder = ['QB', 'RB1', 'RB2', 'WR1', 'WR2', 'TE', 'FLEX', 'K', 'D/ST'];
  const benchSlots = Math.max(5, bench.length + 1);

  return (
    <div style={commonStyles.pageContainer}>
      <Header />
      <h1 style={{ color: '#013369', marginBottom: '30px' }}>Set Your Lineup</h1>
      
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
                  onClick={(player) => handlePlayerClick(player, true)}
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
              {bench[index] ? (
                <PlayerCard 
                  player={bench[index]} 
                  onClick={(player) => handlePlayerClick(player, false)}
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
        <PlayerDetailOverlay
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
          onSubstitute={handleSubstitute}
          isStarter={isSelectedPlayerStarter}
        />
      )}
    </div>
  );
}

export default Starters;