import defaultHeadshot from '../assets/headshots/headshot_default.png';

function PlayerCard({ player, onClick, isStarter }) {
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
        position: 'relative',
        width: '100%',
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #e0e0e0',
        padding: '15px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        ':hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          borderColor: '#013369'
        }
      }}
    >
      {isStarter && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          backgroundColor: '#013369',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '12px',
          fontSize: '0.8rem'
        }}>
          Starter
        </div>
      )}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        backgroundColor: '#013369',
        color: 'white',
        padding: '4px 8px',
        borderRadius: '12px',
        fontSize: '0.8rem'
      }}>
        ${player.cost}
      </div>
      <img 
        src={playerHeadshot}
        alt={`${player.name} headshot`}
        style={{
          width: '100%',
          aspectRatio: '1',
          objectFit: 'cover',
          borderRadius: '8px',
          marginBottom: '10px'
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
          marginBottom: '4px'
        }}>
          {player.name}
        </div>
        <div style={{
          color: '#666',
          fontSize: '0.9rem'
        }}>
          {player.team} • #{player.number} • {player.position}
        </div>
      </div>
    </div>
  );
}

export default PlayerCard; 