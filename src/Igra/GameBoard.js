import React, { useState, useEffect } from "react";
import axios from "axios";
import io from "socket.io-client";
import PlayerHand from "./PlayerHand";
import Talon from "./Talon";
import Licitacija from "./Licitacija";
import "../Styles/GameBoard.css";
import Adut from "./Adut"; // Import nove komponente

// Povezivanje sa backendom putem Socket.IO
const socket = io("http://localhost:5000");

const GameBoard = ({ gameId, userId }) => {
  const [playerHand, setPlayerHand] = useState([]); // Karte igrača
  const [talonCards, setTalonCards] = useState([]); // Talon karte
  const [selectedDiscard, setSelectedDiscard] = useState([]); // Karte za škart
  const [currentRound, setCurrentRound] = useState([]); // Trenutna runda
  const [results, setResults] = useState([]); // Rezultati
  const [talonVisible, setTalonVisible] = useState(false); // Vidljivost talona
  const [selectedBid, setSelectedBid] = useState(null); // Izabrana licitacija
  const [showLicitacija, setShowLicitacija] = useState(true); // Vidljivost licitacije
  const [canDiscard, setCanDiscard] = useState(false); // Kontrola mogućnosti škartovanja


  const [adutSelected, setAdutSelected] = useState(false); // Kontrola izbora aduta
  const [showAdutSelection, setShowAdutSelection] = useState(false);
  const [trump, setTrump] = useState(null); // Adut

  // Funkcija za dohvatanje podataka o igri
  const fetchGameData = async () => {
    try {
      const response = await axios.get(`/api/games/${gameId}`);
      const { hand, talon_cards, trump, results } = response.data;
      setPlayerHand(JSON.parse(hand));
      setTalonCards(JSON.parse(talon_cards));
      setTrump(trump);
      setResults(results);
    } catch (error) {
      console.error("Error fetching game data:", error);
    }
  };

  // Funkcija za označavanje karata za škart
  const toggleDiscardCard = (card) => {
    if (selectedDiscard.includes(card)) {
      // Ako je karta već izabrana, ukloni je iz izbora
      setSelectedDiscard(selectedDiscard.filter((c) => c !== card));
    } else if (selectedDiscard.length < 2) {
      // Ako još nisu izabrane dve karte, dodaj kartu u izbor
      setSelectedDiscard([...selectedDiscard, card]);
    }
  };

  //Sortiranje karate u ruci po jacini i znaku
  const sortHand = (hand) => {
    const suitOrder = ["♠", "♥", "♦", "♣"];
    const valueOrder = ["A", "K", "Q", "J", "10", "9", "8", "7"];

    return hand.sort((a, b) => {
      const suitDifference =
        suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
      if (suitDifference !== 0) {
        return suitDifference;
      }
      return valueOrder.indexOf(a.value) - valueOrder.indexOf(b.value);
    });
  };

  // Funkcija za potvrđivanje škarta
  const confirmDiscard = () => {
    if (selectedDiscard.length === 2) {
      // Kombinujemo karte iz ruke i talona
      const combinedCards = [...playerHand, ...talonCards];

      // Filtriramo karte koje nisu označene za škart
      const remainingCards = combinedCards.filter(
        (card) => !selectedDiscard.includes(card)
      );

      // Uzimamo tačno 10 karata koje nisu označene
      const newHand = remainingCards.slice(0, 10);

      // Postavljamo novo stanje
      setPlayerHand(sortHand(newHand)); // Sortiramo novu ruku
      setTalonCards([]); // Talon je prazan nakon škarta
      setSelectedDiscard([]); // Resetujemo izbor
      setTalonVisible(false); // Sakrivamo talon
      setCanDiscard(false); // Onemogućavamo dalje škartovanje
      setShowAdutSelection(true); // Prikazujemo izbor aduta
    } else {
      alert("Morate izabrati tačno 2 karte za škart!");
    }
  };

  // Socket.IO listener za ažuriranje trenutne runde
  useEffect(() => {
    socket.on("roundUpdate", (data) => {
      setCurrentRound(data.currentRound);
      setResults(data.results);
    });

    return () => {
      socket.off("roundUpdate"); // Očisti listener
    };
  }, []);

  // Dohvatanje podataka pri inicijalizaciji
  useEffect(() => {
    fetchGameData();
  }, []);

  // Renderovanje komponenti
  return (
    <div className="game-board">
      {/* Informacije o igri */}
      <div className="game-info">
        <h1>Game Board</h1>
        <h2>Adut: {trump || "Nije izabran"}</h2>
        <h3>Rezultati:</h3>
        <ul>
          {results.map((res, index) => (
            <li key={index}>
              Igrač {res.userId}: {res.score} poena
            </li>
          ))}
        </ul>
      </div>

      {/* Licitacija */}
      {showLicitacija && (
        <div className="game-licitacija">
          <Licitacija
            setTalonVisible={(visible) => {
              setTalonVisible(visible);
              if (visible) setCanDiscard(true); // Omogućava škartovanje
            }}
            setSelectedBid={setSelectedBid}
            hideLicitacija={() => setShowLicitacija(false)} // Sakriva licitaciju nakon izbora
          />
        </div>
      )}

      {/* Talon prikazan na sredini (ako je otkriven) */}
      {talonVisible && (
        <div className="game-talon">
          <Talon
            talonCards={talonCards}
            selectedDiscard={selectedDiscard}
            toggleDiscardCard={canDiscard ? toggleDiscardCard : () => {}} // Onemogućava škartovanje ako nije dozvoljeno
          />
        </div>
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

      {/* Karte igrača prikazane na dnu */}
      <div className="player-hand-container">
        <PlayerHand
          hand={playerHand}
          setHand={setPlayerHand}
          setTalonCards={setTalonCards} // Funkcija za postavljanje talona
          selectedDiscard={selectedDiscard}
          toggleDiscardCard={canDiscard ? toggleDiscardCard : () => {}} // Onemogućava škartovanje ako nije dozvoljeno
        />
      </div>

      {!showLicitacija && !talonVisible && !adutSelected && (
    <Adut
        setTrump={(suit) => {
            setTrump(suit); // Postavlja adut
            setAdutSelected(true); // Sakriva izbor aduta nakon što je izabran
        }}
    />
)}

      {/* Dugme za potvrdu škarta */}
      {talonVisible && (
        <button className="confirm-discard" onClick={confirmDiscard}>
          Potvrdi škart
        </button>
      )}
    </div>
  );
};

export default GameBoard;
