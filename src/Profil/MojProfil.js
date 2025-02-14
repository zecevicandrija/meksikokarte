// MojProfil.js
import React, { useState, useEffect, useRef } from 'react';
import '../Styles/MojProfil.css';
import { useAuth } from '../Login/AuthContext';
import obicnaprofilna from '../Slike/obicnaprofilna.png';


const MojProfil = () => {
  const { user, loading, updateUser } = useAuth();
  const [avatarHover, setAvatarHover] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [profilePic, setProfilePic] = useState('');
  const [stats, setStats] = useState({
    totalGamesOverall: 0,
    totalWinsOverall: 0,
    totalGamesMonth: 0,
    totalScoreMonth: 0,
    winsMonth: 0,
    bestMonth: 0
  });
  const fileInputRef = useRef(null);
  const [achievements, setAchievements] = useState([]);
  const [gameHistory, setGameHistory] = useState([]);

  useEffect(() => {
    if (user && user.profilna) {
      setProfilePic(user.profilna);
    }
  }, [user]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 200) setShowOverlay(true);
      else setShowOverlay(false);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Učitavanje statistike sa servera
  useEffect(() => {
    if (user && user.id) {
      fetch(`http://localhost:5000/api/stats/${user.id}`)
        .then(response => response.json())
        .then(data => setStats({
          totalGamesOverall: data.totalGamesOverall,
          totalWinsOverall: data.totalWinsOverall,
          totalGamesMonth: data.totalGamesMonth,
          totalScoreMonth: data.totalScoreMonth,
          winsMonth: data.winsMonth,
          bestMonth: data.bestMonth
        }))
        .catch(err => console.error('Greška pri dohvatanju statistike:', err));
    }
  }, [user]);

  // Učitavanje dostignuća sa servera
useEffect(() => {
  if (user && user.id) {
    fetch(`http://localhost:5000/api/dostignuca/${user.id}`)
      .then(response => response.json())
      .then(data => setAchievements(data))
      .catch(err => console.error('Greška pri dohvatanju dostignuća:', err));
  }
}, [user]);

useEffect(() => {
  if (user && user.id) {
    fetch(`http://localhost:5000/api/istorija/${user.id}`)
      .then(response => response.json())
      .then(data => setGameHistory(data))
      .catch(err => console.error("Greška pri dohvatanju istorije partija:", err));
  }
}, [user]);

  const handleAvatarClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!user) {
      console.error('Niste ulogovani!');
      return;
    }
    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('userId', user.id);
    try {
      const response = await fetch('http://localhost:5000/api/korisnici/upload-avatar', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        setProfilePic(data.url);
        updateUser({ profilna: data.url });
      } else {
        console.error('Upload greška:', data.error);
      }
    } catch (error) {
      console.error('Greška pri upload-u:', error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div 
          className="avatar" 
          onMouseEnter={() => setAvatarHover(true)} 
          onMouseLeave={() => setAvatarHover(false)}
          onClick={handleAvatarClick}
          style={{ cursor: 'pointer' }}
        >
          <img src={profilePic || obicnaprofilna} alt="User Avatar" />
          <div className={`avatar-overlay ${avatarHover ? 'hovered' : ''}`}>
            <span className="add-icon">+</span>
          </div>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          style={{ display: 'none' }} 
          accept="image/*"
        />

        <div className="profile-info">
          <h1 className="username">{user ? `${user.ime} ${user.prezime}` : 'Gost'}</h1>
          <p className="rank">ID: {user.id}</p>
          <div className="stats">
            <div className="stat">
              <span className="label">Ukupno odigranih: </span>
              <span className="value">{stats.totalGamesOverall}</span>
            </div>
            <div className="stat">
              <span className="label">Ukupno pobeda: </span>
              <span className="value">{stats.totalWinsOverall}</span>
            </div>
            <div className="stat">
              <span className="label">Odigranih (ovog meseca): </span>
              <span className="value">{stats.totalGamesMonth}</span>
            </div>
            <div className="stat">
              <span className="label">Poeni (ovog meseca): </span>
              <span className="value">{stats.totalScoreMonth}</span>
            </div>
            <div className="stat">
              <span className="label">Pobede (ovog meseca): </span>
              <span className="value">{stats.winsMonth}</span>
            </div>
            <div className="stat">
              <span className="label">Najbolji mesec: </span>
              <span className="value">{stats.bestMonth}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ostatak komponente */}
      <div className="badges-section">
        <h2 className="section-title">Dostignuća</h2>
        <div className="badges-grid">
          {achievements.length > 0 ? (
            achievements.map((ach, index) => (
              <div key={index} className="badge">
                <i className="fa-solid fa-trophy gold"></i> 
                <p>{ach.name}</p>
                <small className="achievement-description">{ach.description}</small>
              </div>
            ))
          ) : (
            <p className='game-title'>Nema dostignuća</p>
          )}
        </div>
      </div>

      <div className={`games-history ${showOverlay ? 'overlay' : ''}`}>
  <h2 className="section-title">Istorija partija</h2>
  <div className="games-grid">
    {gameHistory.length > 0 ? (
      gameHistory.map(game => {
        // Parsiramo podatke o igračima iz JSON kolone
        const players = JSON.parse(game.players);
        // Određujemo da li je trenutni korisnik pobednik
        const isWin = game.winner_id === user.id;
        // Filtriramo protivnike (svi koji nisu trenutni korisnik)
        const opponents = players.filter(p => p.user_id !== user.id);
        // Tražimo podatke o trenutnom korisniku
        const currentUser = players.find(p => p.user_id === user.id);
        
        return (
          <div key={game.id} className="game-card">
            <div className="card-content">
              <h3 className="game-title">{/* Primer: game.table_type ili prilagodite naslov */}</h3>
              <p className="game-date">{new Date(game.created_at).toLocaleDateString('sr-RS')}</p>
              <p className={`game-result ${isWin ? 'win' : 'loss'}`}>
                {isWin ? 'Pobeda!' : 'Poraz'}
              </p>
            </div>
            <div className="card-meta">
              <div className="opponents">
                {opponents.length > 0 ? (
                  opponents.map((opp, idx) => (
                    <div key={idx} className="opponent-line">
                      {opp.ime} {opp.prezime} ({opp.score})
                    </div>
                  ))
                ) : (
                  <div className="opponent-line">Nema protivnika</div>
                )}
              </div>
              {currentUser && (
                <div className="current-user">Ja ({currentUser.score})</div>
              )}
            </div>
          </div>
        );
      })
    ) : (
      <p className="game-title">Nema odigranih partija</p>
    )}
  </div>
</div>


    </div>
  );
};

export default MojProfil;
