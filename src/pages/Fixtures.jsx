import { useNavigate } from 'react-router-dom';

function Fixtures() {
  const navigate = useNavigate();

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      padding: '20px',
      gap: '20px'
    }}>
      <h1>Fixtures</h1>
      
      {/* Placeholder content */}
      <div style={{ 
        padding: '20px', 
        backgroundColor: 'white', 
        borderRadius: '5px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '600px'
      }}>
        <div style={{ marginBottom: '20px' }}>
          <h3>Upcoming Matches</h3>
          <p>No upcoming matches scheduled</p>
        </div>

        <div>
          <h3>Recent Results</h3>
          <p>No recent matches played</p>
        </div>
      </div>

      {/* Back button */}
      <button 
        onClick={() => navigate('/menu')}
        style={{ 
          padding: '10px 20px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          marginTop: '20px'
        }}
      >
        Back to Menu
      </button>
    </div>
  );
}

export default Fixtures;
