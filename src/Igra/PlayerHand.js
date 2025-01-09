import React, { useState, useEffect } from "react";
import { generateDeck } from "./Karte";
import "../Styles/PlayerHand.css";
import axios from "axios";
import { useAuth } from "../Login/AuthContext";
import { useParams } from "react-router-dom";

const PlayerHand = ({
  setTalonCards,
  hand,
  setHand,
  selectedDiscard,
  toggleDiscardCard,
  isWinner,
  socket, // Dodato: socket za emitovanje događaja
}) => {
  const { user } = useAuth();
  const { gameId } = useParams();

  const [playedCards, setPlayedCards] = useState([]); // Drži bacane karte
  const [currentPlayerId, setCurrentPlayerId] = useState(null); // Trenutni igrač
  const [isMyTurn, setIsMyTurn] = useState(false); // Da li je potez trenutnog igrača
  const [turnPlayed, setTurnPlayed] = useState(false);

  const sortHand = (cards) => {
    const suitOrder = ["♠", "♥", "♦", "♣"];
    const valueOrder = ["A", "K", "Q", "J", "10", "9", "8", "7"];
    return [...cards].sort((a, b) => {
      const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
      if (suitDiff !== 0) return suitDiff;
      return valueOrder.indexOf(a.value) - valueOrder.indexOf(b.value);
    });
  };

  useEffect(() => {
    if (user && user.id && gameId) {
      const fetchHand = async () => {
        try {
          const res = await axios.get(
            `http://localhost:5000/api/games/${gameId}/player/${user.id}/hand`
          );
          if (res.data.hand) {
            setHand(sortHand(res.data.hand));
          } else {
            console.warn("Ruka igrača je prazna.");
            setHand([]);
          }
        } catch (error) {
          console.error("Greška prilikom dohvatanja ruke igrača:", error);
          setHand([]);
        }
      };

      fetchHand();
    }
  }, [user, gameId, setHand]);

  useEffect(() => {
    const fetchHandAndPlayedCards = async () => {
      try {
        // Dohvati ruku igrača
        const resHand = await axios.get(
          `http://localhost:5000/api/games/${gameId}/player/${user.id}/hand`
        );
        if (resHand.data.hand) {
          setHand(sortHand(resHand.data.hand));
        }
  
        // Dohvati karte koje su već bačene
        const resPlayed = await axios.get(
          `http://localhost:5000/api/bacanje/${gameId}`
        );
        setPlayedCards((prev) => [
          ...prev,
          ...resPlayed.data.filter(
            (card) => !prev.some(
              (c) => c.card_value === card.card_value && c.card_suit === card.card_suit
            )
          ).map((card) => ({
            ...card,
            image: `/Slike/${card.card_value}_${
              card.card_suit === "♠" ? "spades"
              : card.card_suit === "♥" ? "hearts"
              : card.card_suit === "♦" ? "diamonds"
              : "clubs"
            }.png`,
          })),
        ]);
      } catch (error) {
        console.error("Greška prilikom dohvatanja podataka:", error);
      }
    };
  
    if (user && user.id && gameId) {
      fetchHandAndPlayedCards();
    }
  }, [user, gameId]);
  
  
  

  useEffect(() => {
    socket.on("cardPlayed", (data) => {
      setPlayedCards((prev) => {
        if (
          prev.some(
            (card) =>
              card.card_value === data.cardValue && card.card_suit === data.cardSuit
          )
        ) {
          return prev; // Ako već postoji, ne dodaj ništa
        }
        return [
          ...prev,
          {
            card_value: data.cardValue,
            card_suit: data.cardSuit,
            image: data.image,
          },
        ];
      });
      setCurrentPlayerId(data.nextPlayerId); // Ažurira id igrača na potezu
    });
  
    socket.on("nextPlayer", ({ nextPlayerId }) => {
      console.log("Sledeći igrač:", nextPlayerId); // Debug
      setCurrentPlayerId(nextPlayerId);
    });
  
    return () => {
      socket.off("cardPlayed");
      socket.off("nextPlayer");
    };
  }, [socket]);
  

  useEffect(() => {
    // Proverava da li je trenutni igrač na potezu
    setIsMyTurn(user?.id === currentPlayerId);
  }, [currentPlayerId, user]);

  const handleCardPlay = async (card) => {
    if (!isMyTurn) {
      alert("Nije vaš red za igranje!");
      return;
    }
  
    try {
      console.log("Bacanje karte:", { playerId: user.id, cardValue: card.value, cardSuit: card.suit });
  
      // Pošalji zahtev serveru da unese bacanje u bazu
      await axios.post(`http://localhost:5000/api/bacanje/${gameId}`, {
        playerId: user.id,
        cardValue: card.value,
        cardSuit: card.suit,
      });
  
      // Emituj događaj svim klijentima (sinhronizacija kroz Socket.IO)
      socket.emit("cardPlayed", {
        roundId: gameId,
        playerId: user.id,
        cardValue: card.value,
        cardSuit: card.suit,
        image: card.image,
      });
  
      // Lokalno ukloni kartu iz ruke
      setHand((prevHand) =>
        prevHand.filter((c) => c.value !== card.value || c.suit !== card.suit)
      );
  
      // Dodaj kartu u lokalni state za karte na stolu
      setPlayedCards((prev) => [...prev, card]);
    } catch (error) {
      console.error("Greška pri bacanju karte:", error);
    }
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
            } ${isMyTurn ? "clickable" : ""}`}
            onClick={() =>
              isMyTurn ? handleCardPlay(card) : toggleDiscardCard(card)
            }
          >
            <img src={card.image} alt={`${card.value} ${card.suit}`} />
            <p>
              {card.value} {card.suit}
            </p>
          </div>
        ))}
      </div>
      <div className="played-cards-field">
        <h3>Karte na stolu:</h3>
        <div className="cards">
          {playedCards.map((card, index) => (
            <div key={index} className="card">
              <img src={card.image} alt={`${card.value} ${card.suit}`} />
              <p>
                {card.value} {card.suit}
              </p>
            </div>
          ))}
        </div>
      </div>

      {!isMyTurn && <p>Čekajte svoj red...</p>}
    </div>
  );
};

export default PlayerHand;
