import React, { useState, useEffect } from 'react';
import { generateDeck } from './Karte'; // Import funkcije za generisanje špila
import '../Styles/PlayerHand.css';

const PlayerHand = ({ setTalonCards }) => {
    const [hand, setHand] = useState([]); // State za karte koje igrač dobija

    // Funkcija za generisanje 10 nasumičnih karata i 2 karte za talon
    const dealCards = () => {
        const deck = generateDeck(); // Generišemo kompletan špil
        const shuffledDeck = deck.sort(() => Math.random() - 0.5); // Promešamo špil
        const playerHand = shuffledDeck.slice(0, 10); // Prvih 10 karata za igrača
        const talon = shuffledDeck.slice(10, 12); // Sledeće 2 karte za talon

        // Sortiramo ruku igrača po boji i jačini
        const sortedHand = playerHand.sort((a, b) => {
            // Prvo po boji (♠, ♥, ♦, ♣)
            const suitOrder = ['♠', '♥', '♦', '♣'];
            const suitDifference = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);

            if (suitDifference !== 0) {
                return suitDifference;
            }

            // Ako su boje iste, poredi po jačini (A > K > Q > J > 10 > 9 > 8 > 7)
            const valueOrder = ['A', 'K', 'Q', 'J', '10', '9', '8', '7'];
            return valueOrder.indexOf(a.value) - valueOrder.indexOf(b.value);
        });

        setHand(sortedHand); // Postavljamo sortiranu ruku u state
        setTalonCards(talon); // Postavljamo talon karte u parent state
    };

    useEffect(() => {
        dealCards(); // Generisanje karata pri učitavanju komponente
    }, []);

    return (
        <div className="player-hand">
            <h2>Vaše karte:</h2>
            <div className="cards">
                {hand.map((card) => (
                    <div key={card.id} className="card">
                        <img src={card.image} alt={`${card.value} ${card.suit}`} />
                        <p>{card.value} {card.suit}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PlayerHand;
