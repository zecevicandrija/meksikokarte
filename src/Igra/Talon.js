import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../Styles/Talon.css';

const Talon = ({ gameId, selectedDiscard, toggleDiscardCard }) => {
    const [talonCards, setTalonCards] = useState([]);

    const fetchTalonCards = async () => {
        try {
            const response = await axios.get(`http://localhost:5000/api/games/${gameId}`);
            const { talonCards } = response.data;
            console.log("Dohvaćene talon karte iz baze:", talonCards); // Log za proveru
            setTalonCards(talonCards || []); // Postavljamo talon karte
        } catch (error) {
            console.error("Greška prilikom dohvatanja talon karata:", error);
            setTalonCards([]); // Resetuj na prazan niz u slučaju greške
        }
    };

    useEffect(() => {
        if (gameId) {
            fetchTalonCards();
        }
    }, [gameId]);

    return (
        <div className="talon">
            <h2>Talon:</h2>
            <div className="cards2">
                {talonCards.length === 0 ? (
                    <p>Nema karata u talonu.</p>
                ) : (
                    talonCards.map((card, index) => (
                        <div
                            key={index}
                            className={`card2 ${selectedDiscard.includes(card) ? 'selected' : ''}`}
                            onClick={() => toggleDiscardCard(card)}
                        >
                            <img src={card.image} alt={`${card.value} ${card.suit}`} />
                            <p>{card.value} {card.suit}</p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Talon;
