import './App.css'
import { BrowserRouter as Router, Route, Routes, useNavigate } from 'react-router-dom';

import Login from './pages/Login';
import Menu from './pages/Menu';
import Starters from './pages/Starters';
import Trades from './pages/Trades';
import Fixtures from './pages/Fixtures';
import Leagues from './pages/Leagues';
import PlayerProfile from './pages/PlayerProfile';
import Players from './pages/Players';

// Create a new LandingPage component
const LandingPage = () => {
  const navigate = useNavigate();
  console.log('LandingPage rendered'); // Debug log
  
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      backgroundColor: '#f0f0f0', // Light gray background
    }}>
      <button 
        onClick={() => {
          console.log('Button clicked'); // Debug log
          navigate('/menu');
        }} 
        style={{ 
          padding: '20px 40px', 
          fontSize: '1.2rem',
          backgroundColor: '#007bff', // Blue button
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        Start
      </button>
    </div>
  );
}

function App() {
  console.log('App component rendered'); // Debug log
  
  return (
    <>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/starters" element={<Starters />} />
          <Route path="/trades" element={<Trades />} />
          <Route path="/fixtures" element={<Fixtures />} />
          <Route path="/leagues" element={<Leagues />} />
          <Route path="/player/:playerId" element={<PlayerProfile />} />
          <Route path="/players" element={<Players />} />
        </Routes>
      </Router>
    </>
  );
}

export default App
