import { useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header';
import { commonStyles } from '../styles/commonStyles';
import defaultHeadshot from '../assets/headshot_default.png';

function PlayerProfile() {
  const navigate = useNavigate();
  const { playerId } = useParams();

  // This would normally come from an API or database
  // For now, using mock data
  const playerData = {
    name: 'Tom Brady',
    team: 'TB',
    number: '12',
    position: 'QB',
    stats: {
      passingYards: '4,694',
      touchdowns: '25',
      interceptions: '9',
      completionPercentage: '66.8%',
      qbRating: '102.2'
    },
    info: {
      age: '45',
      height: '6\'4"',
      weight: '225 lbs',
      experience: '23 years',
      college: 'Michigan'
    }
  };

  return (
    <div style={commonStyles.pageContainer}>
      <Header />
      
      <div style={{
        ...commonStyles.card,
        maxWidth: '800px',
        margin: '20px auto'
      }}>
        {/* Player Header */}
        <div style={{
          display: 'flex',
          gap: '30px',
          alignItems: 'center',
          marginBottom: '30px',
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px'
        }}>
          <img 
            src={defaultHeadshot}
            alt={`${playerData.name} headshot`}
            style={{
              width: '200px',
              height: '200px',
              objectFit: 'cover',
              borderRadius: '100px',
              border: '3px solid #013369'
            }}
          />
          <div>
            <h1 style={{ 
              color: '#013369',
              marginBottom: '10px'
            }}>
              {playerData.name}
            </h1>
            <h2 style={{
              color: '#666',
              fontWeight: 'normal',
              marginBottom: '10px'
            }}>
              {playerData.position} • {playerData.team} #{playerData.number}
            </h2>
          </div>
        </div>

        {/* Player Info */}
        <div style={{
          marginBottom: '30px'
        }}>
          <h3 style={{ color: '#013369', marginBottom: '15px' }}>Player Information</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px'
          }}>
            {Object.entries(playerData.info).map(([key, value]) => (
              <div key={key} style={{ padding: '10px' }}>
                <div style={{ color: '#666', fontSize: '0.9rem', textTransform: 'capitalize' }}>{key}</div>
                <div style={{ fontSize: '1.1rem' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ color: '#013369', marginBottom: '15px' }}>Season Statistics</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px'
          }}>
            {Object.entries(playerData.stats).map(([key, value]) => (
              <div key={key} style={{ padding: '10px' }}>
                <div style={{ 
                  color: '#666', 
                  fontSize: '0.9rem', 
                  textTransform: 'capitalize',
                  wordBreak: 'break-word'
                }}>
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </div>
                <div style={{ fontSize: '1.1rem' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '15px',
          justifyContent: 'center',
          marginTop: '30px'
        }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              ...commonStyles.primaryButton,
              padding: '12px 24px'
            }}
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlayerProfile; 