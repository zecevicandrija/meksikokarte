import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../Styles/Talon.css';

const Talon = ({ gameId, selectedDiscard, toggleDiscardCard }) => {
    const [talonCards, setTalonCards] = useState([]);

    const fetchTalonCards = async () => {
        try {
            const response = await axios.get(`http://localhost:5000/api/rounds/${gameId}`);
            const { talonCards } = response.data; // Dohvat talon karata iz odgovora
            console.log("Dohvaćene talon karte iz baze (rounds):", talonCards); // Log za proveru
            setTalonCards(talonCards || []); // Postavi talon karte
        } catch (error) {
            console.error("Greška prilikom dohvatanja talon karata:", error);
            setTalonCards([]); // Resetuj na prazan niz u slučaju greške
        }
    };

    useEffect(() => {
        if (gameId) {
            fetchTalonCards(); // Pozovi funkciju za dohvat talona
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
                            className={`card2 ${selectedDiscard.some(
                                (selectedCard) =>
                                    selectedCard.suit === card.suit &&
                                    selectedCard.value === card.value
                            ) ? 'selected' : ''}`}
                            onClick={() => toggleDiscardCard(card)}
                        >
                            <img src={card.image} alt={`${card.value} ${card.suit}`} />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Talon;
