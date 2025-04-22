import React, { useState, useEffect } from 'react';
import '../Styles/Pocetna.css';
import obicnaprofilna from '../Slike/obicnaprofilna.png';
import { useNavigate } from "react-router-dom";
import { useAuth } from "../Login/AuthContext";
import axios from "axios";
import TopLista from './TopLista';
import Friends from '../Profil/Friends';

const Pocetna = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [tokeni, setTokeni] = useState(0);
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);
  const [showPrivateOptions, setShowPrivateOptions] = useState(false);
  const [privateCode, setPrivateCode] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);

  useEffect(() => {
    const fetchTokeni = async () => {
      try {
        const response = await axios.post('http://localhost:5000/api/tokeni/daily', { userId: user.id });
        setTokeni(response.data.tokeni);
      } catch (error) {
        console.error('Greška prilikom učitavanja tokena:', error);
      }
    };
    if (user?.id) fetchTokeni();
  }, [user]);

  useEffect(() => {
    const checkViewport = () => {
      const matches = window.matchMedia('(max-width: 1000px) and (orientation: landscape)').matches;
      setIsMobileLandscape(matches);
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  const igrajHandler = async () => {
    if (!user?.id) {
      console.error('Korisnik nije prijavljen!');
      return;
    }

    const selectedTable = tables.find(table => table.id === activeTableId);
    if (!selectedTable) {
      alert('Niste odabrali sto!');
      return;
    }

    if (selectedTable.type === 'Privatna partija') {
      setShowPrivateOptions(true);
      return;
    }

    const requiredTokens = selectedTable.coins;
    try {
      const tokenResponse = await axios.get(`http://localhost:5000/api/tokeni/moji?userId=${user.id}`);
      if (tokenResponse.data.tokeni < requiredTokens) {
        alert(`Potrebno vam je ${requiredTokens} tokena za ovaj sto!`);
        return;
      }

      await axios.post('http://localhost:5000/api/tokeni/dodaj', {
        userId: user.id,
        kolicina: -requiredTokens
      });

      const newTokenResponse = await axios.get(`http://localhost:5000/api/tokeni/moji?userId=${user.id}`);
      setTokeni(newTokenResponse.data.tokeni);

      const gameResponse = await axios.post('http://localhost:5000/api/games', { 
        userId: user.id,
        tableType: selectedTable.type,
        betAmount: requiredTokens
      });
      navigate(`/game/${gameResponse.data.gameId}`);
    } catch (error) {
      console.error('Greška:', error.response?.data || error.message);
      if (error.response?.data?.message) alert(error.response.data.message);
    }
  };

  const createPrivateGame = async () => {
    try {
      const response = await axios.post('http://localhost:5000/api/games', {
        userId: user.id,
        tableType: 'Privatna partija',
        betAmount: 100,
        isPrivate: true
      });
      const { gameId, code } = response.data;
      setPrivateCode(code);
      alert(`Vaša privatna igra je kreirana. Kod za pridruživanje: ${code}`);
      navigate(`/game/${gameId}`);
    } catch (error) {
      console.error('Greška pri kreiranju privatne igre:', error);
      alert('Došlo je do greške pri kreiranju igre.');
    }
  };

  const joinPrivateGame = async () => {
    if (!privateCode) {
      alert('Unesite kod za pridruživanje!');
      return;
    }
    try {
      const response = await axios.post('http://localhost:5000/api/games/join-private', {
        userId: user.id,
        code: privateCode
      });
      const { gameId } = response.data;
      navigate(`/game/${gameId}`);
    } catch (error) {
      console.error('Greška pri pridruživanju privatnoj igri:', error);
      alert('Neispravan kod ili igra nije dostupna.');
    }
  };

  // Ostali handleri (logoutHandler, pravilaHandler, itd.) ostaju nepromenjeni

  const tables = [
    { id: 1, type: 'Privatna partija', coins: 100 },
    { id: 2, type: 'Pocetnici', coins: 200 },
    { id: 3, type: 'Prosecni', coins: 500 },
    { id: 4, type: 'Napredni', coins: 1000 }
  ];

  const [startIndex, setStartIndex] = useState(0);
  const [rotateAnim, setRotateAnim] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const visibleTables = Array.from({ length: 3 }, (_, i) => {
    const index = (startIndex + i) % tables.length;
    return tables[index];
  });

  const activeTableId = visibleTables[1]?.id;

  const handleArrowClick = (direction) => {
    const newStartIndex = direction === 'left' 
      ? (startIndex - 1 + tables.length) % tables.length
      : (startIndex + 1) % tables.length;
    setRotateAnim(true);
    setTimeout(() => setRotateAnim(false), 500);
    setStartIndex(newStartIndex);
  };

  const finishGame = async (gameId) => {
    try {
      await axios.post(`http://localhost:5000/api/games/${gameId}/finish`);
      const tokenResponse = await axios.get(`http://localhost:5000/api/tokeni/moji?userId=${user.id}`);
      setTokeni(tokenResponse.data.tokeni);
      alert('Igra je završena i tokeni su dodeljeni.');
    } catch (error) {
      console.error('Greška pri završetku igre:', error);
      alert('Došlo je do greške pri završetku igre.');
    }
  };

  return (
    <div className="home-container">
      <div className="profile-section">
        <div className="user-info">
          <span className="user-name">{user?.ime} {user?.prezime}</span>
        </div>
        <div className="profile-btn" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
          <img src={user?.profilna || obicnaprofilna} alt="Profilna Slika" />
        </div>
        {isDropdownOpen && (
          <div className="dropdown-menu">
            <div className="dropdown-item" onClick={() => navigate("/profil")}>Moj Profil</div>
            <div className="dropdown-item">Nastavi partiju</div>
            <div className="dropdown-item" onClick={() => { logout(); navigate("/login"); }}>Odjavi se</div>
          </div>
        )}
        <div className="token-display">Tokeni: {tokeni}</div>
        <div className="friends-buttons"><Friends /></div>
      </div>
      <div className="main-content">
        {!isMobileLandscape && <TopLista />}
        <div className="game-tables-container">
          <h1 className='meksikoheader'>MEKSIKO</h1>
          <div className="table-carousel">
            <button className="arrow left-arrow" onClick={() => handleArrowClick('left')}>←</button>
            <div className={`table-container3 ${rotateAnim ? 'rotate' : ''}`}>
              {visibleTables.map((table, index) => (
                <div key={table.id} className={`game-table ${activeTableId === table.id ? 'active' : ''}`}>
                  <div className="table-header"><span>{table.type}</span></div>
                  <div className="table-body">{table.coins > 0 && <span className="coin-cost">{table.coins}</span>} tokena</div>
                </div>
              ))}
            </div>
            <button className="arrow right-arrow" onClick={() => handleArrowClick('right')}>→</button>
          </div>
          <div className="play-btn-container">
            <button className="igraj-btn" onClick={igrajHandler}>IGRAJ</button>
          </div>
          {showPrivateOptions && (
            <div className="private-options">
              <button onClick={createPrivateGame}>Kreiraj privatnu igru (100 tokena)</button>
              <button onClick={() => setShowCodeInput(true)}>Pridruži se pomoću koda</button>
              {showCodeInput && (
                <div>
                  <input
                    type="text"
                    value={privateCode}
                    onChange={(e) => setPrivateCode(e.target.value)}
                    placeholder="Unesi 10-cifreni kod"
                    maxLength={10}
                  />
                  <button onClick={joinPrivateGame}>Pridruži se</button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="action-buttons">
          <button className="btn rules-btn" onClick={() => navigate("/pravila")}>‎ ‎ ‎ ‎ Pravila ‎ ‎ ‎  ‎ </button>
          <button className="btn rules-btn" onClick={() => navigate("/kontakt")}>‎ ‎ ‎ Kontakt ‎ ‎ ‎</button>
          <button className="btn settings-btn">Kupi Tokene</button>
          <button className="btn settings-btn" onClick={() => navigate('/gledaj-video')}>Gledaj Video</button>
          {isMobileLandscape && <button className="btn settings-btn" onClick={() => navigate('/top-liste')}>‎ ‎ ‎ Top Liste ‎ ‎ ‎</button>}
        </div>
      </div>
    </div>
  );
};

export default Pocetna;