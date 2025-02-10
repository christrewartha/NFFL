import { useNavigate, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import { commonStyles } from '../styles/commonStyles';
import defaultHeadshot from '../assets/headshots/headshot_default.png';
import { useSquad } from '../context/SquadContext';

function PlayerListItem({ player, onClick, isOnTeam }) {
  let playerHeadshot;
  try {
    playerHeadshot = new URL(`../assets/headshots/${player.id}.png`, import.meta.url).href;
  } catch {
    playerHeadshot = defaultHeadshot;
  }

  return (
    <div 
      onClick={() => !isOnTeam && onClick(player)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 20px',
        borderBottom: '1px solid #eee',
        cursor: isOnTeam ? 'not-allowed' : 'pointer',
        transition: 'background-color 0.2s ease',
        opacity: isOnTeam ? 0.5 : 1,
        backgroundColor: isOnTeam ? '#f8f9fa' : 'white',
        ':hover': {
          backgroundColor: isOnTeam ? '#f8f9fa' : '#f0f0f0'
        }
      }}
      title={isOnTeam ? 'Player already on your team' : ''}
    >
      <img 
        src={playerHeadshot}
        alt={`${player.name} headshot`}
        style={{
          width: '50px',
          height: '50px',
          borderRadius: '25px',
          marginRight: '20px',
          border: '2px solid #013369',
          filter: isOnTeam ? 'grayscale(100%)' : 'none'
        }}
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = defaultHeadshot;
        }}
      />
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: '20px'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ 
            fontSize: '1.1rem', 
            color: isOnTeam ? '#999' : '#013369',
            fontWeight: 'bold'
          }}>
            {player.name}
          </div>
          <div style={{ 
            fontSize: '0.9rem',
            color: isOnTeam ? '#999' : '#666'
          }}>
            {player.team} #{player.number}
          </div>
        </div>
        <div style={{
          backgroundColor: isOnTeam ? '#eee' : '#f8f9fa',
          padding: '5px 15px',
          borderRadius: '15px',
          fontSize: '0.9rem',
          color: isOnTeam ? '#999' : '#013369',
          fontWeight: 'bold'
        }}>
          {player.position}
        </div>
      </div>
    </div>
  );
}

function Players() {
  const navigate = useNavigate();
  const location = useLocation();
  const { squad, replacePlayer } = useSquad();
  const replacingPlayer = location.state?.replacingPlayer;

  // Check if a player is already on the team
  const isPlayerOnTeam = (playerId) => {
    // Check starters
    const inStarters = Object.values(squad.starters).some(
      starter => starter?.id === playerId
    );
    
    // Check bench
    const inBench = squad.bench.some(
      benchPlayer => benchPlayer?.id === playerId
    );

    return inStarters || inBench;
  };

  // Mock available players data - in reality, this would come from an API or database
  const availablePlayers = {
    QB: [
      { id: '2558125', name: 'Patrick Mahomes', team: 'KC', number: '15', position: 'QB' },
      { id: '2560955', name: 'Josh Allen', team: 'BUF', number: '17', position: 'QB' },
      { id: '2563722', name: 'Joe Burrow', team: 'CIN', number: '9', position: 'QB' },
      { id: '2555334', name: 'Jared Goff', team: 'DET', number: '16', position: 'QB' },
      { id: '2566163', name: 'Trevor Lawrence', team: 'JAX', number: '16', position: 'QB' },
    ],
    RB: [
      { id: '2560968', name: 'Saquon Barkley', team: 'NYG', number: '26', position: 'RB' },
      { id: '2561021', name: 'Nick Chubb', team: 'CLE', number: '24', position: 'RB' },
      { id: '2562699', name: 'Tony Pollard', team: 'DAL', number: '20', position: 'RB' },
      { id: '2557997', name: 'Christian McCaffrey', team: 'SF', number: '23', position: 'RB' },
      { id: '2559169', name: 'Austin Ekeler', team: 'LAC', number: '30', position: 'RB' },
      { id: '2562377', name: 'Josh Jacobs', team: 'LV', number: '28', position: 'RB' },
      { id: '2556075', name: 'Derrick Henry', team: 'TEN', number: '22', position: 'RB' },
      { id: '2564148', name: 'Jonathan Taylor', team: 'IND', number: '28', position: 'RB' },
      { id: '2566157', name: 'Travis Etienne', team: 'JAX', number: '1', position: 'RB' },
      { id: '2558116', name: 'Aaron Jones', team: 'GB', number: '33', position: 'RB' },
      { id: '2558019', name: 'Alvin Kamara', team: 'NO', number: '41', position: 'RB' },
      { id: '2566448', name: 'Najee Harris', team: 'PIT', number: '22', position: 'RB' },
      { id: '2568030', name: 'Breece Hall', team: 'NYJ', number: '20', position: 'RB' },
      { id: '2568282', name: 'Kenneth Walker III', team: 'SEA', number: '9', position: 'RB' },
      { id: '2566343', name: 'Rhamondre Stevenson', team: 'NE', number: '38', position: 'RB' },
      { id: '2562722', name: 'Miles Sanders', team: 'CAR', number: '26', position: 'RB' },
      { id: '2567685', name: 'Dameon Pierce', team: 'HOU', number: '31', position: 'RB' },
      { id: '2557978', name: 'James Conner', team: 'ARI', number: '6', position: 'RB' },
      { id: '2566049', name: 'Javonte Williams', team: 'DEN', number: '33', position: 'RB' },
      { id: '2565926', name: 'Khalil Herbert', team: 'CHI', number: '24', position: 'RB' },
      { id: '2568348', name: 'Brian Robinson', team: 'WAS', number: '8', position: 'RB' },
      { id: '2568315', name: 'Rachaad White', team: 'TB', number: '29', position: 'RB' },
      { id: '2563986', name: 'AJ Dillon', team: 'GB', number: '28', position: 'RB' },
      { id: '2558204', name: 'Jamaal Williams', team: 'NO', number: '30', position: 'RB' },
      { id: '2560938', name: 'Jeff Wilson Jr.', team: 'MIA', number: '23', position: 'RB' },
    ],
    WR: [
      { id: '2556214', name: 'Tyreek Hill', team: 'MIA', number: '10', position: 'WR' },
      { id: '2552608', name: 'Stefon Diggs', team: 'BUF', number: '14', position: 'WR' },
      { id: '2563848', name: 'CeeDee Lamb', team: 'DAL', number: '88', position: 'WR' },
      { id: '2564556', name: 'Justin Jefferson', team: 'MIN', number: '18', position: 'WR' },
      { id: '2565941', name: "Ja'Marr Chase", team: 'CIN', number: '1', position: 'WR' },
      { id: '2566409', name: 'DeVonta Smith', team: 'PHI', number: '6', position: 'WR' },
    ],
    TE: [
      { id: '2560957', name: 'Mark Andrews', team: 'BAL', number: '89', position: 'TE' },
      { id: '2562378', name: 'T.J. Hockenson', team: 'MIN', number: '87', position: 'TE' },
      { id: '2560995', name: 'Dallas Goedert', team: 'PHI', number: '88', position: 'TE' },
      { id: '2540258', name: 'Travis Kelce', team: 'KC', number: '87', position: 'TE' },
      { id: '2558266', name: 'George Kittle', team: 'SF', number: '85', position: 'TE' },
    ],
    K: [
      { id: '2558245', name: 'Harrison Butker', team: 'KC', number: '7', position: 'K' },
      { id: '2563596', name: 'Tyler Bass', team: 'BUF', number: '2', position: 'K' },
      { id: '2558172', name: 'Jake Elliott', team: 'PHI', number: '4', position: 'K' },
      { id: '2536340', name: 'Justin Tucker', team: 'BAL', number: '9', position: 'K' },
    ],
    'D/ST': [
      { id: '100025', name: 'Philadelphia', team: 'PHI', number: '', position: 'D/ST' },
      { id: '100008', name: 'Dallas', team: 'DAL', number: '', position: 'D/ST' },
      { id: '100003', name: 'Buffalo', team: 'BUF', number: '', position: 'D/ST' },
      { id: '100029', name: 'San Francisco', team: 'SF', number: '', position: 'D/ST' },
    ]
  };

  // Handle FLEX position by combining RB, WR, and TE
  if (replacingPlayer?.position === 'FLEX') {
    availablePlayers.FLEX = [
      ...availablePlayers.RB,
      ...availablePlayers.WR,
      ...availablePlayers.TE
    ];
  }

  const handlePlayerSelect = (newPlayer) => {
    if (replacingPlayer) {
      replacePlayer(replacingPlayer, newPlayer);
      navigate('/trades');
    }
  };

  const position = replacingPlayer?.position || '';
  const availablePlayersForPosition = position ? (availablePlayers[position] || []) : [];

  return (
    <div style={commonStyles.pageContainer}>
      <Header />
      <h1 style={{ color: '#013369', marginBottom: '30px' }}>Select Replacement Player</h1>
      
      <div style={{
        ...commonStyles.card,
        marginBottom: '20px',
        maxWidth: '800px'
      }}>
        <h2 style={{ color: '#013369', marginBottom: '20px' }}>
          Replacing: {replacingPlayer?.name || 'Empty Slot'} ({position})
        </h2>
        
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #eee',
        }}>
          {availablePlayersForPosition.map((player) => (
            <PlayerListItem 
              key={player.id}
              player={player}
              onClick={handlePlayerSelect}
              isOnTeam={isPlayerOnTeam(player.id)}
            />
          ))}

          {availablePlayersForPosition.length === 0 && (
            <p style={{ 
              textAlign: 'center', 
              color: '#666',
              padding: '20px'
            }}>
              No available players for position {position}
            </p>
          )}
        </div>
      </div>

      <button 
        onClick={() => navigate('/trades')}
        style={{
          ...commonStyles.primaryButton,
          marginTop: '20px'
        }}
      >
        Back to Trades
      </button>
    </div>
  );
}

export default Players; 