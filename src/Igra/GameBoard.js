import React, { useState, useEffect } from "react";
import axios from "axios";
import io from "socket.io-client";
import PlayerHand from "./PlayerHand";
import Talon from "./Talon";
import Licitacija from "./Licitacija";
import "../Styles/GameBoard.css";
import Adut from "./Adut";
import { useParams } from "react-router-dom";
import { useAuth } from "../Login/AuthContext";

// Povezivanje sa Socket.IO serverom (napravi samo jednom na nivou fajla)
const socket = io("http://localhost:5000");

const GameBoard = () => {
  const { user } = useAuth();
  const { gameId } = useParams(); // userId iz URL ti verovatno ne treba
  // -----------------------------
  // State promenljive
  const [playerHand, setPlayerHand] = useState([]);
  const [talonCards, setTalonCards] = useState([]);
  const [selectedDiscard, setSelectedDiscard] = useState([]);
  const [currentRound, setCurrentRound] = useState([]);
  const [roundResults, setRoundResults] = useState([]);
  const [talonVisible, setTalonVisible] = useState(false);
  const [selectedBid, setSelectedBid] = useState(null);
  const [canDiscard, setCanDiscard] = useState(false);

  const [adutSelected, setAdutSelected] = useState(false);
  const [showAdutSelection, setShowAdutSelection] = useState(false);
  const [trump, setTrump] = useState(null);
  const [roundId, setRoundId] = useState(null); 
  const [licitacija, setLicitacija] = useState(null);

  // -----------------------------
  // 1) useEffect - Socket join i event listener-i
  useEffect(() => {
    // Napravi "guard" - ako user ili user.id ne postoje, samo preskoči
    if (!user || !user.id) {
      console.log("User nije definisan, skipujemo joinGame");
      return;
    }

    // joinGame event
    socket.emit("joinGame", { gameId, userId: user.id });
    console.log(`Pridružen igri: gameId=${gameId}, userId=${user.id}`);

    // cardsDealt
    socket.on("cardsDealt", async ({ message }) => {
      console.log(message); // "Karte su podeljene"
      await fetchPlayerHand();
      // posle podeljenih karata, startujemo rundu
      await startRound();
    });

    // licitacijaUpdated
    socket.on("licitacijaUpdated", (data) => {
      console.log("Primio licitacijaUpdated:", data);
      setLicitacija(data);
    });

    // allPlayersJoined
    socket.on("allPlayersJoined", () => {
      console.log("Svi igrači su se pridružili. Delimo karte...");
      dealCards(); // automatski podeli
    });

    // cleanup prilikom unmout
    return () => {
      socket.emit("leaveGame", { gameId, userId: user.id });
      socket.disconnect();
    };
  }, [gameId, user]);

  // -----------------------------
  // 2) useEffect - fetchGameData na mount
  useEffect(() => {
    fetchGameData();
  }, [gameId]);

  // -----------------------------
  // 3) useEffect - posle licitacija završi
  useEffect(() => {
    // Ako licitacija postoji i finished=true => prikaži talon
    if (licitacija?.finished) {
      setTalonVisible(true);
      console.log("Licitacija je gotova. Prikazujem talon!");
    }
  }, [licitacija]);

  // -----------------------------
  // Funkcije (unutar komp, ali van hooks)
  const fetchGameData = async () => {
    try {
      const response = await axios.get(
        `http://localhost:5000/api/games/${gameId}`
      );
      if (!response.data) {
        console.warn("Podaci o igri nisu pronađeni.");
        return;
      }
      const { hand, talon_cards, trump, results } = response.data;
      setPlayerHand(hand ? JSON.parse(hand) : []);
      setTalonCards(talon_cards ? JSON.parse(talon_cards) : []);
      setTrump(trump);
      setRoundResults(results || []);
    } catch (error) {
      console.error(
        "Greška prilikom dohvatanja podataka o igri:",
        error.response?.data || error.message
      );
    }
  };

  const startRound = async () => {
    if (!user?.id) return; // guard
    try {
      const res = await axios.post(
        `http://localhost:5000/api/rounds/${gameId}/start-round`
      );
      console.log("startRound response:", res.data);
      // ako hoces setLicitacija(res.data.licitacija);
    } catch (err) {
      console.error("Greška pri startu runde:", err);
    }
  };

  const dealCards = async () => {
    if (!user?.id) return; 
    try {
      const response = await axios.post("http://localhost:5000/api/games/deal-cards", {
        gameId,
      });
      console.log("Karte su uspešno podeljene:", response.data);
      socket.emit("gameStart", { gameId });
    } catch (error) {
      console.error("Greška prilikom deljenja karata:", error);
    }
  };

  const fetchPlayerHand = async () => {
    if (!user?.id) return;
    try {
      const res = await axios.get(
        `http://localhost:5000/api/games/${gameId}/player/${user.id}/hand`
      );
      if (res.data.hand) {
        setPlayerHand(sortHand(res.data.hand));
      } else {
        console.warn("Stiglo je prazno polje 'hand'!");
        setPlayerHand([]);
      }
    } catch (error) {
      console.error("Greška prilikom dohvatanja karata igrača:", error);
    }
  };

  const sortHand = (cards) => {
    const suitOrder = ["♠", "♥", "♦", "♣"];
    const valueOrder = ["A", "K", "Q", "J", "10", "9", "8", "7"];
    return [...cards].sort((a, b) => {
      const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
      if (suitDiff !== 0) return suitDiff;
      return valueOrder.indexOf(a.value) - valueOrder.indexOf(b.value);
    });
  };

  // toggleDiscardCard
  const toggleDiscardCard = (card) => {
    if (selectedDiscard.includes(card)) {
      setSelectedDiscard(selectedDiscard.filter((c) => c !== card));
    } else if (selectedDiscard.length < 2) {
      setSelectedDiscard([...selectedDiscard, card]);
    }
  };

  // confirmDiscard
  const confirmDiscard = () => {
    if (selectedDiscard.length === 2) {
      const combinedCards = [...playerHand, ...talonCards];
      const remainingCards = combinedCards.filter(
        (card) => !selectedDiscard.includes(card)
      );
      const newHand = remainingCards.slice(0, 10);
      setPlayerHand(newHand);
      setTalonCards([]);
      setSelectedDiscard([]);
      setTalonVisible(false);
      setCanDiscard(false);
      setShowAdutSelection(true);

      // Emitujemo ažuriranje na server
      socket.emit("updateDiscard", {
        gameId,
        userId: user.id, // bitno
        discardedCards: selectedDiscard,
      });
    } else {
      alert("Morate izabrati tačno 2 karte za škart!");
    }
  };

  // -----------------------------
  // Izračunaj currentPlayerId i isWinner
  let currentPlayerId = null;
  if (licitacija && licitacija.playerOrder) {
    const { currentPlayerIndex, playerOrder } = licitacija;
    currentPlayerId = playerOrder[currentPlayerIndex];
  }

  const isMyTurnToBid = (currentPlayerId === user?.id);
  const isWinner = (licitacija?.winnerId === user?.id);

  // -----------------------------
  // Render
  return (
    <div className="game-board">
      {/* Ispis nekih info */}
      <div className="game-info">
        <h1>Game Board</h1>
        <h2>Adut: {trump || "Nije izabran"}</h2>
        <h3>Rezultati trenutne runde:</h3>
        <ul>
          {roundResults.map((res, index) => (
            <li key={index}>
              Igrač {res.userId}: {res.score} poena
            </li>
          ))}
        </ul>
      </div>

      {/* Licitacija */}
      {!licitacija ? (
        <p style={{ fontStyle: "italic", margin: "20px" }}>
          Licitacija trenutno nije pokrenuta...
        </p>
      ) : licitacija.finished ? (
        <>
          <p style={{ fontStyle: "italic", margin: "20px" }}>
            Licitacija je završena!
          </p>
          {/* Po želji: prikaži nešto za kraj licitacije */}
        </>
      ) : isMyTurnToBid ? (
        <Licitacija
          socket={socket}
          roundId={gameId}
          licitacija={licitacija}
          user={user}
        />
      ) : (
        <p style={{ fontStyle: "italic", margin: "20px" }}>
          Čekam da igrač {currentPlayerId} završi licitaciju...
        </p>
      )}

      {/* Talon + Škart */}
      {talonVisible && (
        <Talon
          talonCards={talonCards}
          selectedDiscard={selectedDiscard}
          toggleDiscardCard={isWinner ? toggleDiscardCard : () => {}}
        />
      )}

      {/* Trenutna runda - ako prikazuješ karte na stolu */}
      <div className="current-round">
        <h3>Trenutna runda:</h3>
        <div className="cards">
          {currentRound.map((card, index) => (
            <div key={index} className="card">
              <img src={card.image} alt={`${card.value} ${card.suit}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Karte igrača */}
      <PlayerHand
        hand={playerHand}
        setHand={setPlayerHand}
        setTalonCards={setTalonCards}
        selectedDiscard={selectedDiscard}
        toggleDiscardCard={canDiscard ? toggleDiscardCard : () => {}}
      />

      {/* Izbor aduta - posle škarta */}
      {!talonVisible && !adutSelected && showAdutSelection && (
        <Adut
          setTrump={(suit) => {
            setTrump(suit);
            setAdutSelected(true);
          }}
        />
      )}

      {/* Potvrdi škart dugme - samo za pobednika */}
      {talonVisible && isWinner && (
        <button className="confirm-discard" onClick={confirmDiscard}>
          Potvrdi škart
        </button>
      )}
    </div>
  );
};

export default GameBoard;
