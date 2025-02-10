import React, { useState, useEffect } from 'react';
import '../Styles/TopLista.css';
import axios from 'axios';

const TopLista = () => {
  const [topPlayers, setTopPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTopPlayers = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/toplista');
        setTopPlayers(response.data);
      } catch (error) {
        console.error('Greška pri učitavanju top liste:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTopPlayers();
  }, []);

  if (loading) {
    return <div className="top-list-loading">Učitavam listu...</div>;
  }

  return (
    <div className="top-list-container">
      <h2>TOP LISTA</h2>
      {topPlayers.length === 0 ? (
      <div className="no-players">Trenutno nema igrača na listi</div>
    ) : (
      <ol className="top-list">
        {topPlayers.map((player, index) => (
          <li key={player.id} className="top-list-item">
            <span className="player-rank">{index + 1}.</span>
            <span className="player-name">{player.ime} {player.prezime}</span>
            <span className="player-score">{player.total_score} bodova</span>
          </li>
        ))}
      </ol>
    )}
    </div>
  );
};

export default TopLista;