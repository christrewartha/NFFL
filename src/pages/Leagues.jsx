import { useNavigate } from 'react-router-dom';

function Leagues() {
  const navigate = useNavigate();

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      padding: '20px',
      gap: '20px'
    }}>
      <h1>Leagues</h1>
      
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
          <h3>Your Leagues</h3>
          <p>You haven't joined any leagues yet</p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h3>Available Leagues</h3>
          <p>No public leagues available</p>
        </div>

        <button 
          onClick={() => alert('Create League functionality coming soon!')}
          style={{ 
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Create New League
        </button>
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

export default Leagues;
