import React from 'react';
import { useNavigate } from 'react-router-dom';
import defaultHeadshot from '../assets/headshots/headshot_default.png';

function TradePlayerOverlay({ player, onClose, onReplace, onRemove }) {
  const navigate = useNavigate();
  
  if (!player) return null;

  let playerHeadshot;
  try {
    playerHeadshot = new URL(`../assets/headshots/${player.id}.png`, import.meta.url).href;
  } catch {
    playerHeadshot = defaultHeadshot;
  }

  const handleViewProfile = () => {
    const playerId = player.name.toLowerCase().replace(/\s+/g, '-');
    navigate(`/player/${playerId}`);
    onClose();
  };

  return (
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
    }} onClick={onClose}>
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '500px',
        maxHeight: '80vh',
        overflow: 'auto',
        position: 'relative',
      }} onClick={e => e.stopPropagation()}>
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            border: 'none',
            background: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#666',
          }}
        >
          ×
        </button>

        <div style={{ 
          display: 'flex', 
          gap: '20px',
          marginBottom: '30px',
          alignItems: 'center'
        }}>
          <img 
            src={playerHeadshot}
            alt={`${player.name} headshot`}
            style={{
              width: '150px',
              height: '150px',
              objectFit: 'cover',
              borderRadius: '75px',
              border: '3px solid #013369'
            }}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = defaultHeadshot;
            }}
          />
          <div>
            <h2 style={{ color: '#013369', marginBottom: '10px' }}>{player.name}</h2>
            <p style={{ color: '#666', fontSize: '1.1rem' }}>
              {player.position} • {player.team} #{player.number}
            </p>
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '15px',
          justifyContent: 'center'
        }}>
          <button
            onClick={onReplace}
            style={{
              padding: '12px 24px',
              backgroundColor: '#013369',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            Replace
          </button>
          <button
            onClick={onRemove}
            style={{
              padding: '12px 24px',
              backgroundColor: '#d50a0a',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            Remove
          </button>
          <button
            onClick={handleViewProfile}
            style={{
              padding: '12px 24px',
              backgroundColor: 'white',
              color: '#013369',
              border: '2px solid #013369',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            Full Profile
          </button>
        </div>
      </div>
    </div>
  );
}

export default TradePlayerOverlay; 