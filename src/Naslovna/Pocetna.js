import React, { useState, useEffect } from 'react';
import '../Styles/Pocetna.css';
import obicnaprofilna from '../Slike/obicnaprofilna.png';
import { useNavigate } from "react-router-dom";
import { useAuth } from "../Login/AuthContext";
import axios from "axios";
import TopLista from './TopLista';

const Pocetna = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [tokeni, setTokeni] = useState(0);

  useEffect(() => {
    const fetchTokeni = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/tokeni/moji?userId=${user.id}`);
        setTokeni(response.data.tokeni);
      } catch (error) {
        console.error('Greska prilikom ucitavanja tokena:', error);
      }
    };
    
    if (user?.id) fetchTokeni();
  }, [user]);

  const igrajHandler = async () => {
    if (!user?.id) {
      console.error('Korisnik nije prijavljen!');
      return;
    }
  
    // Pronađi odabrani sto
    const selectedTable = tables.find(table => table.id === activeTableId);
    if (!selectedTable) {
      alert('Niste odabrali sto!');
      return;
    }
  
    const requiredTokens = selectedTable.coins;
  
    try {
      // Provera stanja tokena
      const tokenResponse = await axios.get(`http://localhost:5000/api/tokeni/moji?userId=${user.id}`);
      if (tokenResponse.data.tokeni < requiredTokens) {
        alert(`Potrebno vam je ${requiredTokens} tokena za ovaj sto!`);
        return;
      }
  
      // Oduzimanje tokena
      await axios.post('http://localhost:5000/api/tokeni/dodaj', {
        userId: user.id,
        kolicina: -requiredTokens
      });
  
      // Osveži prikaz tokena
      const newTokenResponse = await axios.get(`http://localhost:5000/api/tokeni/moji?userId=${user.id}`);
      setTokeni(newTokenResponse.data.tokeni);
  
      // Kreiraj igru sa dodatnim parametrima
      const gameResponse = await axios.post('http://localhost:5000/api/games', { 
        userId: user.id,
        tableType: selectedTable.type,
        betAmount: requiredTokens
      });
      
      navigate(`/game/${gameResponse.data.gameId}`);
      
    } catch (error) {
      console.error('Greška:', error.response?.data || error.message);
      if (error.response?.data?.message) {
        alert(error.response.data.message);
      }
    }
  };

  const logoutHandler = () => {
    logout();
    navigate("/login");
  };

  const pravilaHandler = () => {
    navigate("/pravila");
  };

  const profilHandler = () => {
    navigate("/profil");
  };
  

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

  return (
    <div className="home-container">
      
      <div className="profile-section">
        {/* Ime i prezime korisnika */}
        <div className="user-info">
          <span className="user-name">{user?.ime} {user?.prezime}</span>
        </div>
        
        <div 
          className="profile-btn"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <img src={user?.profilna || obicnaprofilna} alt="Profilna Slika" />
        </div>
        {isDropdownOpen && (
          <div className="dropdown-menu">
            <div className="dropdown-item" onClick={profilHandler}>Moj Profil</div>
            <div className="dropdown-item">Nastavi partiju</div>
            <div className="dropdown-item" onClick={logoutHandler}>Odjavi se</div>
          </div>
        )}
        <div className="token-display">
          Tokeni: {tokeni}
        </div>
      </div>
      <div className="main-content">
      <TopLista />
        <div className="game-tables-container">
        <h1 className='meksikoheader'>MEKSIKO</h1>
          <div className="table-carousel">
            <button 
              className="arrow left-arrow" 
              onClick={() => handleArrowClick('left')}
              //disabled={startIndex === 0}
            >
              ←
            </button>
            
            <div className={`table-container ${rotateAnim ? 'rotate' : ''}`}>
              {visibleTables.map((table, index) => (
                <div
                  key={table.id}
                  className={`game-table ${activeTableId === table.id ? 'active' : ''}`}
                >
                  <div className="table-header">
                    <span>{table.type}</span>
                  </div>
                  <div className="table-body">
                    {table.coins > 0 && <span className="coin-cost">{table.coins}</span>} tokena
                  </div>
                </div>
              ))}
            </div>

            <button 
              className="arrow right-arrow" 
              onClick={() => handleArrowClick('right')}
              //disabled={startIndex === tables.length - 3}
            >
              →
            </button>
          </div>
          {/* Dugme IGRAJ se pozicionira ispod centra */}
          <div className="play-btn-container">
            <button className="igraj-btn" onClick={igrajHandler}>IGRAJ</button>
          </div>
        </div>

        <div className="action-buttons">
          <button className="btn rules-btn" onClick={pravilaHandler}>Pravila</button>
          <button className="btn rules-btn">Podesavanja</button>
          <button className="btn settings-btn">Kupi Tokene</button>
          <button className="btn settings-btn" onClick={() => navigate('/gledaj-video')}>Gledaj Video</button>
        </div>
      </div>
    </div>
  );
};

export default Pocetna;
