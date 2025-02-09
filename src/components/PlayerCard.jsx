import defaultHeadshot from '../assets/headshots/headshot_default.png';

function PlayerCard({ player, onClick }) {
  // Dynamically import the player's headshot
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
        width: '200px',
        height: '250px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '15px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer',
        backgroundColor: 'white',
        transition: 'transform 0.2s, box-shadow 0.2s',
        ':hover': {
          transform: 'translateY(-5px)',
          boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
        }
      }}
    >
      <img 
        src={playerHeadshot}
        alt={`${player.name} headshot`}
        style={{
          width: '150px',
          height: '150px',
          borderRadius: '75px',
          marginBottom: '15px',
          border: '3px solid #013369'
        }}
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = defaultHeadshot;
        }}
      />
      <div style={{
        textAlign: 'center'
      }}>
        <div style={{
          fontWeight: 'bold',
          color: '#013369',
          marginBottom: '5px'
        }}>
          {player.name}
        </div>
        <div style={{
          color: '#666',
          fontSize: '0.9rem'
        }}>
          {player.position} • {player.team} #{player.number}
        </div>
      </div>
    </div>
  );
}

export default PlayerCard; 