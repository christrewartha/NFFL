import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import PlayerCard from '../components/PlayerCard';
import { commonStyles } from '../styles/commonStyles';
import PlayerDetailOverlay from '../components/PlayerDetailOverlay';
import { useState } from 'react';

function Starters() {
  const navigate = useNavigate();
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [isSelectedPlayerStarter, setIsSelectedPlayerStarter] = useState(false);

  // Convert starters object to state
  const [startersState, setStartersState] = useState({
    QB: { id: '2555334', name: 'Jared Goff', team: 'DET', number: '16', position: 'QB' },
    RB1: { id: '2556075', name: 'Derrick Henry', team: 'TEN', number: '22', position: 'RB' },
    RB2: { id: '2564148', name: 'Jonathan Taylor', team: 'IND', number: '28', position: 'RB' },
    WR1: { id: '2564556', name: 'Justin Jefferson', team: 'MIN', number: '18', position: 'WR' },
    WR2: { id: '2565941', name: "Ja'Marr Chase", team: 'CIN', number: '1', position: 'WR' },
    TE: { id: '2540258', name: 'Travis Kelce', team: 'KC', number: '87', position: 'TE' },
    FLEX: { id: '2559169', name: 'Austin Ekeler', team: 'LAC', number: '30', position: 'RB' },
    K: { id: '2536340', name: 'Justin Tucker', team: 'BAL', number: '9', position: 'K' },
    'D/ST': { id: '100029', name: 'San Francisco', team: 'SF', number: '', position: 'D/ST' },
  });

  const [benchState, setBenchState] = useState([
    { id: '2566163', name: 'Trevor Lawrence', team: 'JAX', number: '16', position: 'QB' },
    { id: '2557997', name: 'Christian McCaffrey', team: 'SF', number: '23', position: 'RB' },
    { id: '2566409', name: 'DeVonta Smith', team: 'PHI', number: '6', position: 'WR' },
    { id: '2558266', name: 'George Kittle', team: 'SF', number: '85', position: 'TE' },
  ]);

  const positionOrder = ['QB', 'RB1', 'RB2', 'WR1', 'WR2', 'TE', 'FLEX', 'K', 'D/ST'];

  // Calculate number of bench slots needed (max of 5 or current bench size + 1)
  const benchSlots = Math.max(5, benchState.length + 1);

  const handlePlayerClick = (player, isStarter) => {
    setSelectedPlayer(player);
    setIsSelectedPlayerStarter(isStarter);
  };

  const handleSubstitute = () => {
    if (!selectedPlayer) return;

    if (isSelectedPlayerStarter) {
      // Moving from starter to bench
      const starterPosition = Object.entries(startersState).find(
        ([_, player]) => player?.name === selectedPlayer.name
      )?.[0];

      if (starterPosition) {
        // Add to bench at the first available slot
        setBenchState(prev => {
          // Find the first empty slot or append to the end
          const firstEmptyIndex = prev.findIndex(p => !p);
          if (firstEmptyIndex !== -1) {
            const newBench = [...prev];
            newBench[firstEmptyIndex] = selectedPlayer;
            return newBench;
          }
          return [...prev, selectedPlayer];
        });

        // Remove from starters
        setStartersState(prev => ({
          ...prev,
          [starterPosition]: null
        }));
      }
    } else {
      // Moving from bench to starter
      // Find an empty position that matches the player's position
      let targetPosition = null;
      
      if (selectedPlayer.position === 'RB') {
        if (!startersState.RB1) targetPosition = 'RB1';
        else if (!startersState.RB2) targetPosition = 'RB2';
        else if (!startersState.FLEX) targetPosition = 'FLEX';
      } else if (selectedPlayer.position === 'WR') {
        if (!startersState.WR1) targetPosition = 'WR1';
        else if (!startersState.WR2) targetPosition = 'WR2';
        else if (!startersState.FLEX) targetPosition = 'FLEX';
      } else if (selectedPlayer.position === 'TE') {
        if (!startersState.TE) targetPosition = 'TE';
        else if (!startersState.FLEX) targetPosition = 'FLEX';
      } else if (selectedPlayer.position === 'QB' && !startersState.QB) {
        targetPosition = 'QB';
      } else if (selectedPlayer.position === 'K' && !startersState.K) {
        targetPosition = 'K';
      } else if (selectedPlayer.position === 'D/ST' && !startersState['D/ST']) {
        targetPosition = 'D/ST';
      }

      if (targetPosition) {
        // Remove from bench
        setBenchState(prev => prev.filter(player => player?.name !== selectedPlayer.name));
        // Add to starters
        setStartersState(prev => ({
          ...prev,
          [targetPosition]: selectedPlayer
        }));
      }
    }

    setSelectedPlayer(null);
  };

  const handleViewProfile = () => {
    // TODO: Implement view profile logic
    console.log('View profile clicked for:', selectedPlayer);
    setSelectedPlayer(null);
  };

  return (
    <div style={commonStyles.pageContainer}>
      <Header />
      <h1 style={{ color: '#013369', marginBottom: '30px' }}>Starting Lineup</h1>
      
      <div style={{
        ...commonStyles.card,
        marginBottom: '20px',
        maxWidth: '1200px'
      }}>
        <h2 style={{ color: '#013369', marginBottom: '20px' }}>Starters</h2>
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
              {startersState[pos] ? (
                <PlayerCard player={startersState[pos]} onClick={(player) => handlePlayerClick(player, true)} />
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

      <div style={{
        ...commonStyles.card,
        marginBottom: '20px',
        maxWidth: '1200px'
      }}>
        <h2 style={{ color: '#013369', marginBottom: '20px' }}>Bench</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)', // Always 5 columns like starters
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
              {benchState[index] ? (
                <PlayerCard 
                  player={benchState[index]} 
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