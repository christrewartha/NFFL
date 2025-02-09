import nflLogo from '../assets/nfl_logo.png';

function Header() {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      padding: '20px',
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      gap: '20px'
    }}>
      <img 
        src={nflLogo} 
        alt="NFL Logo" 
        style={{
          height: '100px',
          width: 'auto'
        }}
      />
      <h1 style={{
        margin: 0,
        color: '#013369',
        fontSize: '1.8rem',
        fontWeight: 'bold'
      }}>
        National Fantasy Football League
      </h1>
    </div>
  );
}

export default Header; 