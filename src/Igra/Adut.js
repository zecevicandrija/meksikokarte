import React, { useState } from 'react';
import '../Styles/Adut.css';

const Adut = ({ setTrump }) => {
    const [selectedSuit, setSelectedSuit] = useState(null); // Trenutno izabrani adut
    const suits = ['♠', '♥', '♦', '♣']; // Dostupni znakovi

    const handleSuitClick = (suit) => {
        setSelectedSuit(suit); // Postavljamo lokalno stanje
        setTrump(suit); // Postavljamo adut u roditeljski state
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
