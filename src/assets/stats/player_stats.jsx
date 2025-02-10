// Mock available players data - in reality, this would come from an API or database
const availablePlayers = {
  QB: [
    { id: '2558125', name: 'Patrick Mahomes', team: 'KC', number: '15', position: 'QB' },
    { id: '2560955', name: 'Josh Allen', team: 'BUF', number: '17', position: 'QB' },
    { id: '2563722', name: 'Joe Burrow', team: 'CIN', number: '9', position: 'QB' },
    { id: '2555334', name: 'Jared Goff', team: 'DET', number: '16', position: 'QB' },
    { id: '2566163', name: 'Trevor Lawrence', team: 'JAX', number: '16', position: 'QB' },
  ],
  RB: [
    { id: '2560968', name: 'Saquon Barkley', team: 'NYG', number: '26', position: 'RB' },
    { id: '2561021', name: 'Nick Chubb', team: 'CLE', number: '24', position: 'RB' },
    { id: '2562699', name: 'Tony Pollard', team: 'DAL', number: '20', position: 'RB' },
    { id: '2557997', name: 'Christian McCaffrey', team: 'SF', number: '23', position: 'RB' },
    { id: '2559169', name: 'Austin Ekeler', team: 'LAC', number: '30', position: 'RB' },
    { id: '2562377', name: 'Josh Jacobs', team: 'LV', number: '28', position: 'RB' },
    { id: '2556075', name: 'Derrick Henry', team: 'TEN', number: '22', position: 'RB' },
    { id: '2564148', name: 'Jonathan Taylor', team: 'IND', number: '28', position: 'RB' },
    { id: '2566157', name: 'Travis Etienne', team: 'JAX', number: '1', position: 'RB' },
    { id: '2558116', name: 'Aaron Jones', team: 'GB', number: '33', position: 'RB' },
    { id: '2558019', name: 'Alvin Kamara', team: 'NO', number: '41', position: 'RB' },
    { id: '2566448', name: 'Najee Harris', team: 'PIT', number: '22', position: 'RB' },
    { id: '2568030', name: 'Breece Hall', team: 'NYJ', number: '20', position: 'RB' },
    { id: '2568282', name: 'Kenneth Walker III', team: 'SEA', number: '9', position: 'RB' },
    { id: '2566343', name: 'Rhamondre Stevenson', team: 'NE', number: '38', position: 'RB' },
    { id: '2562722', name: 'Miles Sanders', team: 'CAR', number: '26', position: 'RB' },
    { id: '2567685', name: 'Dameon Pierce', team: 'HOU', number: '31', position: 'RB' },
    { id: '2557978', name: 'James Conner', team: 'ARI', number: '6', position: 'RB' },
    { id: '2566049', name: 'Javonte Williams', team: 'DEN', number: '33', position: 'RB' },
    { id: '2565926', name: 'Khalil Herbert', team: 'CHI', number: '24', position: 'RB' },
    { id: '2568348', name: 'Brian Robinson', team: 'WAS', number: '8', position: 'RB' },
    { id: '2568315', name: 'Rachaad White', team: 'TB', number: '29', position: 'RB' },
    { id: '2563986', name: 'AJ Dillon', team: 'GB', number: '28', position: 'RB' },
    { id: '2558204', name: 'Jamaal Williams', team: 'NO', number: '30', position: 'RB' },
    { id: '2560938', name: 'Jeff Wilson Jr.', team: 'MIA', number: '23', position: 'RB' },
  ],
  WR: [
    { id: '2556214', name: 'Tyreek Hill', team: 'MIA', number: '10', position: 'WR' },
    { id: '2552608', name: 'Stefon Diggs', team: 'BUF', number: '14', position: 'WR' },
    { id: '2563848', name: 'CeeDee Lamb', team: 'DAL', number: '88', position: 'WR' },
    { id: '2564556', name: 'Justin Jefferson', team: 'MIN', number: '18', position: 'WR' },
    { id: '2565941', name: "Ja'Marr Chase", team: 'CIN', number: '1', position: 'WR' },
    { id: '2566409', name: 'DeVonta Smith', team: 'PHI', number: '6', position: 'WR' },
  ],
  TE: [
    { id: '2560957', name: 'Mark Andrews', team: 'BAL', number: '89', position: 'TE' },
    { id: '2562378', name: 'T.J. Hockenson', team: 'MIN', number: '87', position: 'TE' },
    { id: '2560995', name: 'Dallas Goedert', team: 'PHI', number: '88', position: 'TE' },
    { id: '2540258', name: 'Travis Kelce', team: 'KC', number: '87', position: 'TE' },
    { id: '2558266', name: 'George Kittle', team: 'SF', number: '85', position: 'TE' },
  ],
  K: [
    { id: '2558245', name: 'Harrison Butker', team: 'KC', number: '7', position: 'K' },
    { id: '2563596', name: 'Tyler Bass', team: 'BUF', number: '2', position: 'K' },
    { id: '2558172', name: 'Jake Elliott', team: 'PHI', number: '4', position: 'K' },
    { id: '2536340', name: 'Justin Tucker', team: 'BAL', number: '9', position: 'K' },
  ],
  'D/ST': [
    { id: '100025', name: 'Philadelphia', team: 'PHI', number: '', position: 'D/ST' },
    { id: '100008', name: 'Dallas', team: 'DAL', number: '', position: 'D/ST' },
    { id: '100003', name: 'Buffalo', team: 'BUF', number: '', position: 'D/ST' },
    { id: '100029', name: 'San Francisco', team: 'SF', number: '', position: 'D/ST' },
  ]
}

export default availablePlayers;
