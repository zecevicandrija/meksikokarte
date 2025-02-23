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
  isClearing,
}) => {
  const { user } = useAuth();
  const { gameId } = useParams();

  const [isMyTurn, setIsMyTurn] = useState(false);
  const [turnPlayed, setTurnPlayed] = useState(false);
  const [firstSuit, setFirstSuit] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  // State za delay koji je povezan sa isClearing
  const [delayActive, setDelayActive] = useState(false);
  // State koji sprečava pokretanje više zahteva odjednom
  const [isProcessing, setIsProcessing] = useState(false);
  // Novi state za dodatni delay od 200ms nakon clearTable
  const [postClearDelay, setPostClearDelay] = useState(false);

  useEffect(() => {
    if (isClearing) {
      setDelayActive(true);
    } else {
      const timer = setTimeout(() => {
        setDelayActive(false);
      }, 600); // Nakon 600ms, delay se isključuje
      return () => clearTimeout(timer);
    }
  }, [isClearing]);

  useEffect(() => {
    if (!socket) return;
  
    // Postavi početno stanje
    setIsMyTurn(user?.id === activePlayerId);
    console.log("Početni activePlayerId:", activePlayerId);
  
    // Slušaj stanje sa servera
    socket.on("gameState", (data) => {
      console.log("Primljeno stanje igre:", data);
      setIsMyTurn(user?.id === data.currentActivePlayer);
    });
  
    return () => {
      socket.off("gameState");
    };
  }, [socket, user, activePlayerId]);

  useEffect(() => {
    if (!socket) return;

    socket.on("nextTurn", ({ nextPlayerId }) => {
      console.log("nextTurn primljen za igrača:", nextPlayerId);
      if (nextPlayerId === user.id) {
        setTurnPlayed(false);
      }
    });

    socket.on("clearTable", () => {
      setTurnPlayed(false);
      // Pokreni dodatni delay od 200ms nakon clearTable
      setPostClearDelay(true);
      setTimeout(() => {
        setPostClearDelay(false);
      }, 200);
    });

    return () => {
      socket.off("nextTurn");
      socket.off("clearTable");
    };
  }, [socket, user]);

  useEffect(() => {
    if (currentRound && currentRound.length > 0) {
      setFirstSuit(currentRound[0].card_suit);
    } else {
      setFirstSuit(null);
    }
  }, [currentRound]);

  const handleCardPlay = async (card) => {
    if (!isMyTurn) {
      alert("Nije vaš red za igranje!");
      return;
    }

    if (licitacija?.noTrump) {
      if (trumpSuit) {
        alert("Meksiko se igra bez aduta!");
        return;
      }
    } else {
      if (!trumpSuit) {
        alert("Adut nije izabran!");
        return;
      }
    }

    if (currentRound.length !== 0) {
      if (firstSuit && hasMatchingSuit() && card.suit !== firstSuit) {
        setErrorMessage("Moraš odgovoriti na znak.");
        return;
      }
      if (!hasMatchingSuit() && trumpSuit && hasTrumpSuit() && card.suit !== trumpSuit) {
        setErrorMessage("Moraš baciti adut jer nemaš odgovarajući znak.");
        return;
      }
      setErrorMessage("");
    }

    try {
      // Spreči višestruki poziv dok se zahtev obrađuje
      setIsProcessing(true);
      console.log("Bacanje karte:", {
        playerId: user.id,
        cardValue: card.value,
        cardSuit: card.suit,
      });

      await axios.post(`http://localhost:5000/api/bacanje/${gameId}`, {
        playerId: user.id,
        cardValue: card.value,
        cardSuit: card.suit,
      });

      const isTrumpCard = card.suit === trumpSuit;
      if (isTrumpCard) {
        socket.emit("trumpPlayed", { gameId, winnerId: user.id });
      }

      const updatedHand = hand.filter(
        (c) => c.value !== card.value || c.suit !== card.suit
      );
      setHand(updatedHand);
      setTurnPlayed(true);
    } catch (error) {
      console.error("Greška pri bacanju karte:", error);
    } finally {
      // Omogući nove klikove tek kada se prethodni zahtev kompletira
      setIsProcessing(false);
    }
  };

  const hasMatchingSuit = () => {
    if (!firstSuit) return false;
    return hand.some((card) => card.suit === firstSuit);
  };

  const hasTrumpSuit = () => {
    if (!trumpSuit) return false;
    return hand.some((card) => card.suit === trumpSuit);
  };

  const handleCardClick = (card) => {
    // Ako je delay aktivan, postClearDelay ili već obrađujemo jedan zahtev, ignoriši klik
    if (delayActive || isProcessing || postClearDelay) {
      console.log("Klik ignorisan zbog aktivnog delay perioda ili obrade.");
      return;
    }

    const canDiscard = talonVisible && isWinner && !discardConfirmed;
    if (canDiscard) {
      toggleDiscardCard(card);
    } else if (isMyTurn) {
      handleCardPlay(card);
    } else {
      console.log("Nije dozvoljen klik u ovom trenutku.");
    }
  };

  return (
    <div className="player-hand">
      {errorMessage && <p className="error-message">{errorMessage}</p>}
      {isMyTurn && <p>Na potezu si!</p>}
      <div className="cards">
        {hand.map((card, index) => (
          <div
            key={index}
            className={`card ${
              selectedDiscard.some(
                (sc) => sc.suit === card.suit && sc.value === card.value
              )
                ? "selected"
                : ""
            } ${card.isPlayed ? "played" : ""} ${card.isClearing ? "clearing" : ""}`}
            style={{
              visibility: card.isPlayed ? "hidden" : "visible",
              pointerEvents: card.isClearing ? "none" : "default",
            }}
            onClick={() => handleCardClick(card)}
          >
            <img src={card.image} alt={`${card.value} ${card.suit}`} />
          </div>
        ))}
      </div>
      {!isMyTurn && <p>Čekajte svoj red...</p>}
    </div>
  );
};

export default PlayerHand;
