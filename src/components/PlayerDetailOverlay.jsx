import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import defaultHeadshot from '../assets/headshots/headshot_default.png';
import { useSquad } from '../context/SquadContext';

function PlayerDetailOverlay({ player, onClose, isStarter }) {
  const navigate = useNavigate();
  const { squad, moveToStarters, movePlayerToBench } = useSquad();
  const { starters } = squad;
  const [showReplaceOptions, setShowReplaceOptions] = useState(false);
  
  if (!player) return null;

  const handleViewProfile = () => {
    const playerId = player.name.toLowerCase().replace(/\s+/g, '-');
    navigate(`/player/${playerId}`);
    onClose();
  };

  // Get available positions this player could take
  const getAvailablePositions = () => {
    const positions = [];
    const flexEligible = ['RB', 'WR', 'TE'].includes(player.position);
    
    switch (player.position) {
      case 'QB':
        positions.push({ slot: 'QB', current: starters.QB });
        break;
      case 'RB':
        positions.push(
          { slot: 'RB1', current: starters.RB1 },
          { slot: 'RB2', current: starters.RB2 }
        );
        if (flexEligible) {
          positions.push({ slot: 'FLEX', current: starters.FLEX });
        }
        break;
      case 'WR':
        positions.push(
          { slot: 'WR1', current: starters.WR1 },
          { slot: 'WR2', current: starters.WR2 }
        );
        if (flexEligible) {
          positions.push({ slot: 'FLEX', current: starters.FLEX });
        }
        break;
      case 'TE':
        positions.push({ slot: 'TE', current: starters.TE });
        if (flexEligible) {
          positions.push({ slot: 'FLEX', current: starters.FLEX });
        }
        break;
      case 'K':
        positions.push({ slot: 'K', current: starters.K });
        break;
      case 'D/ST':
        positions.push({ slot: 'D/ST', current: starters['D/ST'] });
        break;
    }
    return positions;
  };

  const handleBenchClick = () => {
    if (isStarter) {
      const starterPosition = Object.entries(starters).find(
        ([_, p]) => p?.id === player.id
      )?.[0];
      if (starterPosition) {
        movePlayerToBench(player, starterPosition);
        onClose();
      }
    } else {
      // Check for empty slots first
      const availablePositions = getAvailablePositions();
      const emptySlot = availablePositions.find(pos => !pos.current);
      
      if (emptySlot) {
        // If there's an empty slot, use it automatically
        moveToStarters(player, emptySlot.slot);
        onClose();
      } else {
        // If all slots are filled, show replacement options
        setShowReplaceOptions(true);
      }
    }
  };

  const handleReplace = (position) => {
    moveToStarters(player, position);
    onClose();
  };

  let playerHeadshot;
  try {
    playerHeadshot = new URL(`../assets/headshots/${player.id}.png`, import.meta.url).href;
  } catch {
    playerHeadshot = defaultHeadshot;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '30px',
        maxWidth: '500px',
        width: '90%',
        position: 'relative'
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: '#666'
          }}
        >
          ×
        </button>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <img 
            src={playerHeadshot}
            alt={`${player.name} headshot`}
            style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              marginRight: '20px',
              border: '3px solid #013369'
            }}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = defaultHeadshot;
            }}
          />
          <div>
            <h2 style={{ 
              color: '#013369',
              marginBottom: '5px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              {player.name}
              <span style={{
                backgroundColor: '#013369',
                color: 'white',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '1rem'
              }}>
                ${player.cost}
              </span>
            </h2>
            <div style={{
              color: '#666',
              fontSize: '1.1rem'
            }}>
              {player.team} • #{player.number} • {player.position}
              {isStarter && (
                <span style={{
                  marginLeft: '10px',
                  color: '#013369',
                  fontWeight: 'bold'
                }}>
                  • Starter
                </span>
              )}
            </div>
          </div>
        </div>

        {!showReplaceOptions ? (
          <div style={{
            display: 'flex',
            gap: '15px',
            justifyContent: 'center'
          }}>
            <button
              onClick={handleBenchClick}
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
              {isStarter ? 'Move to Bench' : 'Move to Starting'}
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
        ) : (
          <div>
            <h3 style={{ color: '#013369', marginBottom: '15px', textAlign: 'center' }}>
              Choose player to replace:
            </h3>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              {getAvailablePositions()
                .filter(pos => pos.current) // Only show filled positions
                .map(({ slot, current }) => (
                  <button
                    key={slot}
                    onClick={() => handleReplace(slot)}
                    style={{
                      padding: '12px',
                      backgroundColor: 'white',
                      color: '#013369',
                      border: '2px solid #013369',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      ':hover': {
                        backgroundColor: '#f8f9fa'
                      }
                    }}
                  >
                    <span>{current.name}</span>
                    <span style={{ color: '#666', fontSize: '0.9rem' }}>
                      {slot}
                    </span>
                  </button>
              ))}
              <button
                onClick={() => setShowReplaceOptions(false)}
                style={{
                  padding: '12px',
                  backgroundColor: '#f8f9fa',
                  color: '#666',
                  border: '1px solid #ccc',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  marginTop: '10px'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PlayerDetailOverlay; 