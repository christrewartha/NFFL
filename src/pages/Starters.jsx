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
  
  const { squad, moveToStarters, movePlayerToBench, money, teamCost } = useSquad();
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
      // Find an empty position that matches the player's position
      let targetPosition = null;
      const flexEligible = ['RB', 'WR', 'TE'].includes(selectedPlayer.position);
      
      switch (selectedPlayer.position) {
        case 'QB':
          if (!starters.QB) targetPosition = 'QB';
          break;
        case 'RB':
          if (!starters.RB1) targetPosition = 'RB1';
          else if (!starters.RB2) targetPosition = 'RB2';
          else if (!starters.FLEX && flexEligible) targetPosition = 'FLEX';
          break;
        case 'WR':
          if (!starters.WR1) targetPosition = 'WR1';
          else if (!starters.WR2) targetPosition = 'WR2';
          else if (!starters.FLEX && flexEligible) targetPosition = 'FLEX';
          break;
        case 'TE':
          if (!starters.TE) targetPosition = 'TE';
          else if (!starters.FLEX && flexEligible) targetPosition = 'FLEX';
          break;
        case 'K':
          if (!starters.K) targetPosition = 'K';
          break;
        case 'D/ST':
          if (!starters['D/ST']) targetPosition = 'D/ST';
          break;
      }

      if (targetPosition) {
        moveToStarters(selectedPlayer, targetPosition);
      }
    }
    setSelectedPlayer(null);
  };

  const starterPositions = [
    { label: 'QB', player: starters.QB },
    { label: 'RB1', player: starters.RB1 },
    { label: 'RB2', player: starters.RB2 },
    { label: 'WR1', player: starters.WR1 },
    { label: 'WR2', player: starters.WR2 },
    { label: 'TE', player: starters.TE },
    { label: 'RB/WR/TE', player: starters.FLEX },
    { label: 'K', player: starters.K },
    { label: 'D/ST', player: starters['D/ST'] }

  ];

  return (
    <div style={commonStyles.pageContainer}>
      <Header />
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px'
      }}>
        <h1 style={{ color: '#013369' }}>Starting Lineup</h1>
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
      
      {/* Starters section */}
      <div style={{
        ...commonStyles.card,
        marginBottom: '20px',
        maxWidth: '1300px',
        padding: '30px'
      }}>
        <h2 style={{ color: '#013369', marginBottom: '20px' }}>Starting Lineup</h2>
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
          {starterPositions.map(({ label, player }) => (
            <div key={label} style={{
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
                {label}
              </div>
              {player ? (
                <PlayerCard 
                  player={player} 
                  onClick={(player) => handlePlayerClick(player, true)}
                />
              ) : (
                <div style={{
                  width: '100%',
                  aspectRatio: '1',
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
        maxWidth: '1300px',
        padding: '30px'
      }}>
        <h2 style={{ color: '#013369', marginBottom: '20px' }}>Bench</h2>
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
          {bench.map((player) => (
            <div key={player.id} style={{
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
                {player.position}
              </div>
              <PlayerCard 
                player={player} 
                onClick={(player) => handlePlayerClick(player, false)}
              />
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
          isStarter={isSelectedPlayerStarter}
        />
      )}
    </div>
  );
}

export default Starters;