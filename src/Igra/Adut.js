import React, { useState } from 'react';
import '../Styles/Adut.css';
import axios from 'axios';

const Adut = ({ setTrump, gameId }) => {
    const [selectedSuit, setSelectedSuit] = useState(null); // Trenutno izabrani adut
    const suits = ['♠', '♥', '♦', '♣']; // Dostupni znakovi

    const handleSuitClick = async (suit) => {
        setSelectedSuit(suit); // Lokalno ažuriramo
        setTrump(suit); // Postavljamo u roditeljski state
      
        try {
          await axios.post(`http://localhost:5000/api/rounds/${gameId}/set-trump`, { adut: suit });
          console.log(`Adut postavljen: ${suit}`);
        } catch (error) {
          console.error('Greška pri postavljanju aduta:', error);
        }
      };
      

    return (
        <div className="adut">
            <h2>Izaberite Aduta:</h2>
            <div className="adut-options">
                {suits.map((suit, index) => (
                    <button
                        key={index}
                        className={`adut-option ${selectedSuit === suit ? 'selected' : ''}`}
                        onClick={() => handleSuitClick(suit)}
                        disabled={!!selectedSuit} // Onemogućava izbor više puta
                    >
                        {suit}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default Adut;
