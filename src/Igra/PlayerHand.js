import React, { useState, useEffect } from 'react';
import { generateDeck } from './Karte'; 
import '../Styles/PlayerHand.css';
import axios from 'axios';
import { useAuth } from '../Login/AuthContext'; 
import { useParams } from 'react-router-dom';

const PlayerHand = ({ 
  setTalonCards, 
  hand, 
  setHand, 
  selectedDiscard, 
  toggleDiscardCard,
  isWinner,
}) => {
    const { user } = useAuth();
    const { gameId } = useParams();

    // Dodatno stanje da onemogućimo beskonačno ponavljanje
    const [fetchedOnce, setFetchedOnce] = useState(false);

    // -----------------------------------------------
    // (nije obavezno, ali lepo je imati) sort funkcija
    const sortHand = (cards) => {
      const suitOrder = ['♠', '♥', '♦', '♣'];
      const valueOrder = ['A', 'K', 'Q', 'J', '10', '9', '8', '7'];
      return [...cards].sort((a, b) => {
        const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
        if (suitDiff !== 0) return suitDiff;
        return valueOrder.indexOf(a.value) - valueOrder.indexOf(b.value);
      });
    };
    // -----------------------------------------------

    // useEffect za dohvatanje ruke iz baze
    useEffect(() => {
      // Ako već jesmo probali fetch (fetchedOnce), nemoj opet
      // i naravno, proveri da li su user i gameId definisani
      if (!fetchedOnce && user && user.id && gameId) {
        const fetchHand = async () => {
          try {
            const res = await axios.get(
              `http://localhost:5000/api/games/${gameId}/player/${user.id}/hand`
            );
            if (res.data.hand) {
              // Ako želiš sortirati dobijene karte
              const sorted = sortHand(res.data.hand);
              setHand(sorted);
            } else {
              // Ako dobijemo 200, ali prazno polje
              console.warn('Ruka igrača je prazna.');
              // Setuj makar prazan niz da `hand.length` više nije 0 
              // (i da se ne pravi loop)
              setHand([]);
            }
          } catch (error) {
            // Ako je 404 ili neka druga greška, odštampaj
            console.error('Greška prilikom dohvatanja ruke igrača:', error);

            // Takođe setuj ruku na [] da izbegneš loop
            setHand([]);
          } finally {
            setFetchedOnce(true); 
          }
        };

        fetchHand();
      }
    }, [fetchedOnce, user, user?.id, gameId, setHand]);

    // (Opciono) Generisanje lokalno 10 karata + 2 za talon
    // Ovo je verovatno samo primer, ali inače “dealCards” radite pozivom
    // POST /api/games/deal-cards na backend
    const dealCards = () => {
        const deck = generateDeck();
        const shuffledDeck = deck.sort(() => Math.random() - 0.5);
        const playerHand = shuffledDeck.slice(0, 10);
        const talon = shuffledDeck.slice(10, 12);

        const sortedHand = sortHand(playerHand);
        setHand(sortedHand);
        setTalonCards(talon);
    };
    return (
      <div className="player-hand">
        <h2>Vaše karte:</h2>
        <div className="cards">
          {hand.map((card, index) => (
            <div
              key={index}
              className={`card ${
                selectedDiscard.some(
                  (selectedCard) =>
                    selectedCard.suit === card.suit &&
                    selectedCard.value === card.value
                )
                  ? "selected"
                  : ""
              }`}
              onClick={() => {
                if (isWinner) {
                  toggleDiscardCard(card); // Dozvoli označavanje samo ako je igrač pobednik
                }
              }}
            >
              <img src={card.image} alt={`${card.value} ${card.suit}`} />
              <p>
                {card.value} {card.suit}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
};

export default PlayerHand;
