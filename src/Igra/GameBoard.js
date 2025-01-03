import React, { useState, useEffect } from "react";
import axios from "axios";
import io from "socket.io-client";
import PlayerHand from "./PlayerHand";
import Talon from "./Talon";
import Licitacija from "./Licitacija";
import "../Styles/GameBoard.css";
import Adut from "./Adut"; // Komponenta za izbor aduta
import { useParams } from 'react-router-dom';
import { useAuth } from '../Login/AuthContext';

// Povezivanje sa Socket.IO serverom
const socket = io("http://localhost:5000");

const GameBoard = () => {
  const [playerHand, setPlayerHand] = useState([]); // Karte igrača
  const [talonCards, setTalonCards] = useState([]); // Talon karte
  const [selectedDiscard, setSelectedDiscard] = useState([]); // Karte za škart
  const [currentRound, setCurrentRound] = useState([]); // Trenutna runda
  const [roundResults, setRoundResults] = useState([]); // Rezultati trenutne runde
  const [talonVisible, setTalonVisible] = useState(false); // Vidljivost talona
  const [selectedBid, setSelectedBid] = useState(null); // Izabrana licitacija
  const [showLicitacija, setShowLicitacija] = useState(true); // Vidljivost licitacije
  const [canDiscard, setCanDiscard] = useState(false); // Omogućeno škartovanje

  const { user } = useAuth();
  const { gameId, userId } = useParams();

  const [adutSelected, setAdutSelected] = useState(false); // Da li je adut izabran
  const [showAdutSelection, setShowAdutSelection] = useState(false);
  const [trump, setTrump] = useState(null); // Adut igre

  // Funkcija za dohvatanje podataka o trenutnoj igri
  const fetchGameData = async () => {
    try {
      const response = await axios.get(`http://localhost:5000/api/games/${gameId}`);
      if (!response.data) {
        console.warn('Podaci o igri nisu pronađeni.');
        return;
      }
  
      const { hand, talon_cards, trump, results } = response.data;
      setPlayerHand(hand ? JSON.parse(hand) : []);
      setTalonCards(talon_cards ? JSON.parse(talon_cards) : []);
      setTrump(trump);
      setRoundResults(results || []);
    } catch (error) {
      console.error('Greška prilikom dohvatanja podataka o igri:', error.response?.data || error.message);
    }
  };
  

  // Socket.IO događaji
  useEffect(() => {
    // Ako user ne postoji (ili nema user.id), nemoj još emitovati
    if (!user || !user.id) {
      console.log("User nije definisan, ne emituje joinGame");
      return;
    }
  
    socket.emit("joinGame", { gameId, userId: user.id });
    console.log(`Pridružen igri: gameId=${gameId}, userId=${user.id}`);
  
    // Slušamo kad stigne signal da su karte podeljene
    socket.on("cardsDealt", ({ message }) => {
      console.log(message); // "Karte su podeljene (automatski)."
      // Onda dohvati ruku iz baze
      fetchPlayerHand();
    });
  
    return () => {
      socket.emit("leaveGame", { gameId, userId: user.id });
      socket.disconnect();
    };
  }, [gameId, user]);
  

  // Dohvatanje podataka o igri pri inicijalizaciji
  useEffect(() => {
    fetchGameData();
  }, []);

  // Funkcija za označavanje karata za škart
  const toggleDiscardCard = (card) => {
    if (selectedDiscard.includes(card)) {
      setSelectedDiscard(selectedDiscard.filter((c) => c !== card));
    } else if (selectedDiscard.length < 2) {
      setSelectedDiscard([...selectedDiscard, card]);
    }
  };
// Funkcija za deljenje karata
const dealCards = async () => {
  try {
      const response = await axios.post('http://localhost:5000/api/games/deal-cards', {
          gameId,
      });

      console.log('Karte su uspešno podeljene:', response.data);

      // Emitovanje događaja za početak igre
      socket.emit('gameStart', { gameId });
  } catch (error) {
      console.error('Greška prilikom deljenja karata:', error);
  }
};


const handleDealCards = async () => {
  try {
    // POST /api/rounds/:gameId/deal
    const response = await axios.post(
      `http://localhost:5000/api/rounds/${gameId}/deal`
    );
    console.log('Round dealt:', response.data);
// Sada dohvati svoju ruku iz game_players:
await fetchPlayerHand();

    // Možeš npr. nakon ovoga da refrešuješ ruku iz baze
  } catch (error) {
    console.error('Error dealing cards:', error.response?.data || error.message);
  }
};

const fetchPlayerHand = async () => {
  try {
    // Ova ruta mora da postoji u backendu: router.get("/api/games/:gameId/player/:playerId/hand", ...)
    const res = await axios.get(
      `http://localhost:5000/api/games/${gameId}/player/${user.id}/hand`
    );
    if (res.data.hand) {
      setPlayerHand(res.data.hand);
      // Ako želiš da sortiraš, možeš ovde sort pre setovanja
    } else {
      console.warn("Stiglo je prazno polje 'hand'!");
      setPlayerHand([]);
    }
  } catch (error) {
    console.error("Greška prilikom dohvatanja karata igrača:", error);
  }
};

// Emitovanje događaja nakon pridruživanja svih igrača
useEffect(() => {
  socket.on('allPlayersJoined', () => {
      console.log('Svi igrači su se pridružili. Delimo karte...');
      dealCards();
  });
}, []);


  // Funkcija za potvrdu škarta
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
        userId,
        discardedCards: selectedDiscard,
      });
    } else {
      alert("Morate izabrati tačno 2 karte za škart!");
    }
  };

  // Renderovanje GameBoard komponente
  return (
    <div className="game-board">
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
      {showLicitacija && (
        <Licitacija
          setTalonVisible={(visible) => {
            setTalonVisible(visible);
            if (visible) setCanDiscard(true);
          }}
          setSelectedBid={setSelectedBid}
          hideLicitacija={() => setShowLicitacija(false)}
        />
      )}

      {/* Talon */}
      {talonVisible && (
        <Talon
          talonCards={talonCards}
          selectedDiscard={selectedDiscard}
          toggleDiscardCard={canDiscard ? toggleDiscardCard : () => {}}
        />
      )}

      {/* Trenutna runda */}
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

      {/* Izbor aduta */}
      {!showLicitacija && !talonVisible && !adutSelected && (
        <Adut
          setTrump={(suit) => {
            setTrump(suit);
            setAdutSelected(true);
          }}
        />
      )}

      {/* Potvrda škarta */}
      {talonVisible && (
        <button className="confirm-discard" onClick={confirmDiscard}>
          Potvrdi škart
        </button>
      )}
    </div>
  );
};

export default GameBoard;
