import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { commonStyles } from '../styles/commonStyles';

function Menu() {
  const navigate = useNavigate();

  const menuItems = [
    { name: 'Starting Lineup', path: '/starters' },
    { name: 'Trades', path: '/trades' },
    { name: 'Fixtures', path: '/fixtures' },
    { name: 'Leagues', path: '/leagues' },
  ];

  const menuButtonStyle = {
    width: '100%',
    maxWidth: '300px',
    padding: '20px',
    margin: '10px',
    fontSize: '1.2rem',
    backgroundColor: '#013369', // NFL Blue
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  };

  return (
    <div style={commonStyles.pageContainer}>
      <Header />
      <h1 style={{ marginBottom: '30px', color: '#013369' }}>Main Menu</h1>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '15px',
        width: '100%',
      }}>
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            style={menuButtonStyle}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.backgroundColor = '#004a8d';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.backgroundColor = '#013369';
            }}
          >
            {item.name}
          </button>
        ))}
      </div>

      <button
        onClick={() => navigate('/login')}
        style={{
          ...menuButtonStyle,
          backgroundColor: '#d50a0a', // NFL Red
          maxWidth: '200px',
          marginTop: '40px',
          fontSize: '1rem',
          ':hover': {
            backgroundColor: '#ff0000',
          }
        }}
      >
        Sign Out
      </button>
    </div>
  );
}

export default Menu;
