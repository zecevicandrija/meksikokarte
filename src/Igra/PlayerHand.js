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
  currentPlayerId,
  setLicitacija,
  activePlayerId,
  currentRound,
  trumpSuit,
  licitacija,
}) => {
  const { user } = useAuth();
  const { gameId } = useParams();

  const [isMyTurn, setIsMyTurn] = useState(false);
  const [turnPlayed, setTurnPlayed] = useState(false);

  const [firstSuit, setFirstSuit] = useState(null); // Prvi znak na stolu
  const [errorMessage, setErrorMessage] = useState(""); // Poruka greške


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
        setTurnPlayed(false); 
      }
    });

    socket.on("clearTable", () => {
      setTurnPlayed(false); 
    });

    return () => {
      socket.off("nextTurn");
      socket.off("clearTable");
    };
  }, [socket, user]);

  //Odgovaranje na znak
  useEffect(() => {
    if (currentRound && currentRound.length > 0) {
      setFirstSuit(currentRound[0].card_suit); // Prvi znak na stolu
    } else {
      setFirstSuit(null); // Resetuj kada runda počne
    }
  }, [currentRound]);
  

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


  // Handler za BACANJE KARTE
  const handleCardPlay = async (card) => {
    if (!isMyTurn) {
      alert("Nije vaš red za igranje!");
      return;
    }

    if (licitacija?.noTrump) {
      // Igranje bez aduta
      if (trumpSuit) {
        alert("Meksiko se igra bez aduta!");
        return;
      }
      // Preskoči sve provere vezane za adut
    } else {
      // Normalne provere za adut
      if (!trumpSuit) {
        alert("Adut nije izabran!");
        return;
      }
    }

     // Provera: Ako nema karata na stolu, prvi igrač može da baci bilo šta
  if (currentRound.length === 0) {
    setErrorMessage(""); // Resetuj grešku
  } else {
    // Igrač mora odgovoriti na znak ako ga ima
    if (firstSuit && hasMatchingSuit() && card.suit !== firstSuit) {
      setErrorMessage("Moraš odgovoriti na znak.");
      return;
    }

    // Ako igrač nema znak da odgovori, mora baciti adut
    if (!hasMatchingSuit() && trumpSuit && hasTrumpSuit() && card.suit !== trumpSuit) {
      setErrorMessage("Moraš baciti adut jer nemaš odgovarajući znak.");
      return;
    }

    setErrorMessage(""); // Ukloni grešku ako je potez validan
  }

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

      // Proveri da li je karta adut
    const isTrumpCard = card.suit === trumpSuit;

    // Emituj događaj ako je igrač pobednik poteza (bacio aduta)
    if (isTrumpCard) {
      socket.emit("trumpPlayed", { gameId, winnerId: user.id });
    }

      // 2) Ukloni iz local state
      const updatedHand = hand.filter(
        (c) => c.value !== card.value || c.suit !== card.suit
      );

      // 3) Pošalji serveru i novu ruku (možda nepotrebno ako to radi bacanje?)
      // await axios.post(`http://localhost:5000/api/rounds/${gameId}/update-hand`, {
      //   userId: user.id,
      //   newHand: updatedHand,
      // });

      // 4) Ažuriraj local state
      setHand(updatedHand);
      setTurnPlayed(true);
    } catch (error) {
      console.error("Greška pri bacanju karte:", error);
    }
  };

  // Provera da li se poklapa sa odgovaranjem na znak
  const hasMatchingSuit = () => {
    if (!firstSuit) return false; // Nema prvog znaka
    return hand.some((card) => card.suit === firstSuit); // Proveri ruku
  };

   // Proverava da li igrač ima kartu sa znakom aduta
   const hasTrumpSuit = () => {
    if (!trumpSuit) return false;
    return hand.some((card) => card.suit === trumpSuit);
  };
  

  return (
    <div className="player-hand">
       {errorMessage && <p className="error-message">{errorMessage}</p>} {/* Prikaz poruke greške */}
      {isMyTurn && <p>Na potezu si!</p>}
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
            {/* <p>
              {card.value} {card.suit}
            </p> */}
          </div>
        ))}
      </div>

      {!isMyTurn && <p>Čekajte svoj red...</p>}
    </div>
  );
};

export default PlayerHand;
