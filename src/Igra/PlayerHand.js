import React, { useState, useEffect } from "react";
import "../Styles/PlayerHand.css";
import axios from "axios";
import { useAuth } from "../Login/AuthContext";
import { useParams } from "react-router-dom";

const PlayerHand = ({
  hand,
  setHand,
  selectedDiscard,
  toggleDiscardCard,
  isWinner,
  socket,
  talonVisible,
  discardConfirmed,
  currentPlayerId,     // <--- Novo: stiže iz GameBoard
  setLicitacija,       // Ako hoćeš da ažuriraš licitaciju (nije obavezno)
  activePlayerId,
}) => {
  const { user } = useAuth();
  const { gameId } = useParams();

  // Čuva internu logiku je li moj red ili ne
  const [isMyTurn, setIsMyTurn] = useState(false);
  // Samo ako ti treba ograničenje da ne bacaš dve karte u istoj turi:
  const [turnPlayed, setTurnPlayed] = useState(false);

  // Svaki put kad se currentPlayerId promeni, proveravamo da li sam to ja
  useEffect(() => {
    setIsMyTurn(user?.id === activePlayerId);
    console.log("Ažuriran activePlayerId na:", activePlayerId);
  }, [user, activePlayerId]);

  // Dodavanje logike za resetovanje `turnPlayed`
  useEffect(() => {
    if (!socket) return;

    // Kada je na potezu sledeći igrač
    socket.on("nextTurn", ({ nextPlayerId }) => {
      console.log("nextTurn primljen za igrača:", nextPlayerId);
      if (nextPlayerId === user.id) {
        setTurnPlayed(false); // Resetujemo `turnPlayed` za naš potez
      }
    });

    // Kada se tabla briše
    socket.on("clearTable", () => {
      setTurnPlayed(false); // Resetujemo `turnPlayed` kada se tabla briše
    });

    // Čišćenje listener-a prilikom unmount-a
    return () => {
      socket.off("nextTurn");
      socket.off("clearTable");
    };
  }, [socket, user]);

  // Helper za sortiranje karata
  const sortHand = (cards) => {
    const suitOrder = ["♠", "♥", "♦", "♣"];
    const valueOrder = ["A", "K", "Q", "J", "10", "9", "8", "7"];
    return [...cards].sort((a, b) => {
      const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
      if (suitDiff !== 0) return suitDiff;
      return valueOrder.indexOf(a.value) - valueOrder.indexOf(b.value);
    });
  };

  // ----------------------------------
  // Handler za BACANJE KARTE
  // ----------------------------------
  const handleCardPlay = async (card) => {
    if (!isMyTurn) {
      alert("Nije vaš red za igranje!");
      return;
    }
    // Ako ograničavaš da se može baciti samo 1 karta po potezu:
    // if (turnPlayed) {
    //   alert("Već ste bacili kartu u ovom potezu!");
    //   return;
    // }

    try {
      console.log("Bacanje karte:", {
        playerId: user.id,
        cardValue: card.value,
        cardSuit: card.suit,
      });

      // 1) Pošalji serveru: "bacam kartu"
      await axios.post(`http://localhost:5000/api/bacanje/${gameId}`, {
        playerId: user.id,
        cardValue: card.value,
        cardSuit: card.suit,
      });

      // 2) Ukloni iz local state
      const updatedHand = hand.filter(
        (c) => c.value !== card.value || c.suit !== card.suit
      );

      // 3) Pošalji serveru i novu ruku (možda nepotrebno ako to radi bacanje?)
      await axios.post(`http://localhost:5000/api/rounds/${gameId}/update-hand`, {
        userId: user.id,
        newHand: updatedHand,
      });

      // 4) Ažuriraj local state
      setHand(updatedHand);
      setTurnPlayed(true);
    } catch (error) {
      console.error("Greška pri bacanju karte:", error);
    }
  };

  // ----------------------------------
  // Render
  // ----------------------------------
  return (
    <div className="player-hand">
      <h2>Vaše karte:</h2>
      <div className="cards">
        {hand.map((card, index) => (
          <div
            key={index}
            className={`card ${
              selectedDiscard.some(
                (sc) =>
                  sc.suit === card.suit &&
                  sc.value === card.value
              )
                ? "selected"
                : ""
            }`}
            onClick={() => {
              // Logika klik-a:
              const canDiscard = talonVisible && isWinner && !discardConfirmed;
              if (canDiscard) {
                // Škart
                toggleDiscardCard(card);
              } else if (isMyTurn) {
                // Bacanje karte
                handleCardPlay(card);
              } else {
                console.log("Nije dozvoljen klik u ovom trenutku.");
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

      {!isMyTurn && <p>Čekajte svoj red...</p>}
    </div>
  );
};

export default PlayerHand;
