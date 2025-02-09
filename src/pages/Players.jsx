import { useNavigate, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import { commonStyles } from '../styles/commonStyles';
import defaultHeadshot from '../assets/headshots/headshot_default.png';

function PlayerListItem({ player, onClick }) {
  let playerHeadshot;
  try {
    playerHeadshot = new URL(`../assets/headshots/${player.id}.png`, import.meta.url).href;
  } catch {
    playerHeadshot = defaultHeadshot;
  }

  return (
    <div 
      onClick={() => onClick(player)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 20px',
        borderBottom: '1px solid #eee',
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
        ':hover': {
          backgroundColor: '#f8f9fa'
        }
      }}
    >
      <img 
        src={playerHeadshot}
        alt={`${player.name} headshot`}
        style={{
          width: '50px',
          height: '50px',
          borderRadius: '25px',
          marginRight: '20px',
          border: '2px solid #013369'
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
            color: '#013369',
            fontWeight: 'bold'
          }}>
            {player.name}
          </div>
          <div style={{ 
            fontSize: '0.9rem',
            color: '#666'
          }}>
            {player.team} #{player.number}
          </div>
        </div>
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '5px 15px',
          borderRadius: '15px',
          fontSize: '0.9rem',
          color: '#013369',
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
  const replacingPlayer = location.state?.replacingPlayer;

  // Mock available players data - in reality, this would come from an API
  const availablePlayers = {
    QB: [
      { id: '2558125', name: 'Patrick Mahomes', team: 'KC', number: '15', position: 'QB' },
      { id: '2560955', name: 'Josh Allen', team: 'BUF', number: '17', position: 'QB' },
      { id: '2560968', name: 'Joe Burrow', team: 'CIN', number: '9', position: 'QB' },
    ],
    RB: [
      { id: '2557973', name: 'Saquon Barkley', team: 'NYG', number: '26', position: 'RB' },
      { id: '2556370', name: 'Nick Chubb', team: 'CLE', number: '24', position: 'RB' },
      { id: '2562699', name: 'Tony Pollard', team: 'DAL', number: '20', position: 'RB' },
      { id: '2558123', name: 'Christian McCaffrey', team: 'SF', number: '23', position: 'RB' },
      { id: '2556227', name: 'Austin Ekeler', team: 'LAC', number: '30', position: 'RB' },
      { id: '2560743', name: 'Josh Jacobs', team: 'LV', number: '28', position: 'RB' },
      { id: '2556075', name: 'Derrick Henry', team: 'TEN', number: '22', position: 'RB' },
      { id: '2558159', name: 'Jonathan Taylor', team: 'IND', number: '28', position: 'RB' },
      { id: '2563646', name: 'Travis Etienne', team: 'JAX', number: '1', position: 'RB' },
      { id: '2556445', name: 'Aaron Jones', team: 'GB', number: '33', position: 'RB' },
      { id: '2555334', name: 'Alvin Kamara', team: 'NO', number: '41', position: 'RB' },
      { id: '2563242', name: 'Najee Harris', team: 'PIT', number: '22', position: 'RB' },
      { id: '2563722', name: 'Breece Hall', team: 'NYJ', number: '20', position: 'RB' },
      { id: '2563898', name: 'Kenneth Walker III', team: 'SEA', number: '9', position: 'RB' },
      { id: '2563896', name: 'Rhamondre Stevenson', team: 'NE', number: '38', position: 'RB' },
      { id: '2557880', name: 'Miles Sanders', team: 'CAR', number: '26', position: 'RB' },
      { id: '2563661', name: 'Dameon Pierce', team: 'HOU', number: '31', position: 'RB' },
      { id: '2556367', name: 'James Conner', team: 'ARI', number: '6', position: 'RB' },
      { id: '2563275', name: 'Javonte Williams', team: 'DEN', number: '33', position: 'RB' },
      { id: '2563161', name: 'Khalil Herbert', team: 'CHI', number: '24', position: 'RB' },
      { id: '2563867', name: 'Brian Robinson', team: 'WAS', number: '8', position: 'RB' },
      { id: '2563605', name: 'Rachaad White', team: 'TB', number: '29', position: 'RB' },
      { id: '2564002', name: 'AJ Dillon', team: 'GB', number: '28', position: 'RB' },
      { id: '2556214', name: 'Jamaal Williams', team: 'NO', number: '30', position: 'RB' },
      { id: '2559205', name: 'Jeff Wilson Jr.', team: 'MIA', number: '23', position: 'RB' },
    ],
    WR: [
      { id: '2562721', name: 'Justin Jefferson', team: 'MIN', number: '18', position: 'WR' },
      { id: '2563275', name: "Ja'Marr Chase", team: 'CIN', number: '1', position: 'WR' },
      { id: '2552409', name: 'Travis Kelce', team: 'KC', number: '87', position: 'TE' },
      { id: '2555459', name: 'George Kittle', team: 'SF', number: '85', position: 'TE' },
    ],
    TE: [
      { id: '2558125', name: 'Mark Andrews', team: 'BAL', number: '89', position: 'TE' },
      { id: '2558159', name: 'T.J. Hockenson', team: 'MIN', number: '87', position: 'TE' },
      { id: '2558123', name: 'Dallas Goedert', team: 'PHI', number: '88', position: 'TE' },
    ],
    K: [
      { id: '2539335', name: 'Justin Tucker', team: 'BAL', number: '9', position: 'K' },
      { id: '2560955', name: 'Tyler Bass', team: 'BUF', number: '2', position: 'K' },
      { id: '2560968', name: 'Jake Elliott', team: 'PHI', number: '4', position: 'K' },
    ],
    'D/ST': [
      { id: '100003', name: 'San Francisco', team: 'SF', number: '', position: 'D/ST' },
      { id: '2558123', name: 'Dallas', team: 'DAL', number: '', position: 'D/ST' },
      { id: '2558125', name: 'Buffalo', team: 'BUF', number: '', position: 'D/ST' },
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

  const handlePlayerSelect = (player) => {
    // TODO: Implement the player replacement logic
    console.log('Selected player:', player);
    navigate('/trades');
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
        maxWidth: '800px'  // Reduced max width for list view
      }}>
        <h2 style={{ color: '#013369', marginBottom: '20px' }}>
          Replacing: {replacingPlayer?.name} ({position})
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