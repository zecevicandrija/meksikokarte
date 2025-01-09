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
//import Bacanje from "./Bacanje";

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
  const [loading, setLoading] = useState(true); // Dodajte zastavicu

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
    socket.on("cardsDealt", (data, callback) => {
  try {
    io.to(`game_${data.gameId}`).emit("cardsDealt", data);
    callback({ success: true });
  } catch (error) {
    console.error("Greška pri emitovanju:", error);
    callback({ success: false, error });
  }
});





    // Slušamo ažuriranje licitacije
    socket.on("licitacijaUpdated", (data) => {
      console.log("Ažurirana licitacija:", data);
      setLicitacija(data);

      // Ako je licitacija završena, prikazujemo talon
      if (data?.finished) {
        setTalonVisible(true);
      }
    });

    // allPlayersJoined
    socket.on("allPlayersJoined", () => {
      console.log("Svi igrači su se pridružili. Delimo karte...");
      dealCards(); // automatski podeli
    });

    // cleanup prilikom unmout
    return () => {
      socket.emit("leaveGame", { gameId, userId: user.id });
      socket.off("cardsDealt");
      socket.off("licitacijaUpdated");
    };
  }, [gameId, user]);


  useEffect(() => {
    const initializeGame = async () => {
      setLoading(true);
      try {
        await fetchGameData(); // Učitavanje početnih podataka
        socket.emit("joinGame", { gameId, userId: user.id });
      } finally {
        setLoading(false);
      }
    };
    initializeGame();
  }, [gameId, user]);


  // -----------------------------
  // 2) useEffect - fetchGameData na mount
  useEffect(() => {
    fetchGameData();
  }, [gameId]);

  useEffect(() => {
    if (!licitacija) {
      console.log("Pokrećem start-round jer licitacija ne postoji.");
      startRound(); // Inicijalizuje licitaciju ako nije postavljena
    }
  }, [licitacija]);

  useEffect(() => {
    if (!socket) {
      console.error("Socket nije inicijalizovan!");
      return;
    }
    const handleCardsDealt = async () => {
      await fetchPlayerHand();
      await fetchGameData();
    };

    const handleLicitacijaUpdated = (data) => {
      setLicitacija(data);
    };

    socket.on("cardsDealt", handleCardsDealt);
    socket.on("licitacijaUpdated", handleLicitacijaUpdated);

    socket.on("trumpUpdated", (adut) => {
      console.log("Adut ažuriran:", adut);
      setTrump(adut);
    });

    const handleHandUpdated = ({ userId, newHand }) => {
      if (userId === user.id) {
        console.log("Vaša ruka je ažurirana:", newHand);
        setPlayerHand(sortHand(newHand));
      }
    };
    // Slušamo ažuriranje ruke posle skarta
    socket.on("handUpdated", handleHandUpdated);
    //sakrivanje talona
    const handleHideTalon = () => {
      setTalonVisible(false);
    };

    socket.on("hideTalon", handleHideTalon);

    return () => {
      socket.off("cardsDealt", handleCardsDealt);
      socket.off("licitacijaUpdated", handleLicitacijaUpdated);
      socket.off("handUpdated", handleHandUpdated);
      socket.off("hideTalon", handleHideTalon);
    };
  }, []);

  useEffect(() => {
    if (adutSelected && licitacija?.finished) {
      socket.emit("startTurn", { roundId: gameId, playerId: licitacija.winnerId });
      console.log(`Emitovan startTurn za pobednika: ${licitacija.winnerId}`);
    }
  }, [adutSelected, licitacija, gameId, socket]);
  

  // Funkcije (unutar komp, ali van hooks)
  const fetchGameData = async () => {
    if (!user || !user.id) {
      console.warn("Korisnik nije definisan prilikom poziva fetchGameData.");
      return;
    }
    
    try {
      const res = await axios.get(`http://localhost:5000/api/rounds/${gameId}`);
      const { roundId, talonCards, licitacija, playerHands, adut } = res.data;
  
      console.log("Dohvaćeni podaci o rundi:", res.data); // Dodato za debug
  
      setRoundId(roundId || null);
      setTalonCards(talonCards || []);
      setLicitacija(licitacija || {}); // Postavlja licitaciju
      setTrump(adut || null);
  
      if (!playerHands || !Array.isArray(playerHands)) {
        console.warn("playerHands nije definisan ili nije niz!");
        setPlayerHand([]);
        return;
      }
  
      const myHand = playerHands.find((p) => p.userId === user.id)?.hand || [];
      setPlayerHand(sortHand(myHand));
    } catch (err) {
      if (err.response?.status === 404) {
        console.warn("Runda nije pronađena. Čekamo da se kreira.");
      } else {
        console.error("Greška pri dohvatanju podataka o igri:", err);
      }
      setPlayerHand([]); // Resetujemo ruku ako se desi greška
    }
  };
  
  
  

  const startRound = async () => {
    if (!user?.id) return; // guard
  
    try {
      const res = await axios.post(
        `http://localhost:5000/api/rounds/${gameId}/start-round`
      );
  
      if (res.data.message === "Čeka se još igrača.") {
        console.warn(res.data.message);
        return;
      }
  
      console.log("startRound response:", res.data);
    } catch (err) {
      console.error("Greška pri startu runde:", err);
    }
  };
  

  const dealCards = async () => {
    if (talonCards && talonCards.length > 0) {
      console.log("Karte su već podeljene. Preskačem dealCards.");
      return;
    }

    try {
      const response = await axios.post(
        `http://localhost:5000/api/rounds/${gameId}/deal`
      );
      console.log("Karte su uspešno podeljene:", response.data);

      // Emitovanje događaja
      socket.emit("cardsDealt", { message: "Karte su podeljene." }, (ack) => {
        if (ack.success) {
          console.log("Karte su uspešno ažurirane.");
        } else {
          console.error("Greška pri emitovanju cardsDealt:", ack.error);
        }
      });
      

      // Dohvati podatke o igri da osvežiš stanje
      await fetchGameData();
    } catch (error) {
      console.error(
        "Greška prilikom deljenja karata:",
        error.response?.data || error.message
      );
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
    if (
      selectedDiscard.some(
        (selectedCard) =>
          selectedCard.suit === card.suit && selectedCard.value === card.value
      )
    ) {
      // Uklanja kartu ako je već označena
      setSelectedDiscard(
        selectedDiscard.filter(
          (selectedCard) =>
            selectedCard.suit !== card.suit || selectedCard.value !== card.value
        )
      );
    } else if (selectedDiscard.length < 2) {
      // Dodaje kartu ako ima mesta za škart
      setSelectedDiscard([...selectedDiscard, card]);
    } else {
      alert("Možete odabrati najviše 2 karte za škart!");
    }
  };

  // confirmDiscard
  const confirmDiscard = async () => {
    if (selectedDiscard.length === 2) {
      try {
        // Kombinujemo sve karte iz ruke i talona
        const combinedCards = [...playerHand, ...talonCards]; // trebalo bi 12
        console.log("combinedCards =>", combinedCards);

        const remainingCards = combinedCards.filter(
          (c) =>
            !selectedDiscard.some(
              (d) => d.suit === c.suit && d.value === c.value
            )
        );
        console.log("remainingCards =>", remainingCards);

        if (remainingCards.length !== combinedCards.length - 2) {
          console.error("Očekivao sam 10, dobio sam", remainingCards.length);
          alert("Došlo je do greške: više karata je uklonjeno nego što treba!");
          return;
        }

        const newHand = sortHand(remainingCards.slice(0, 10));

        // Ažuriranje stanja
        setPlayerHand(newHand); // Nova ruka
        setTalonCards([]); // Talon se prazni
        setSelectedDiscard([]); // Resetuje se škart
        setTalonVisible(false); // Sakrivamo talon
        setCanDiscard(false); // Onemogućavamo dalje škartanje
        setShowAdutSelection(true); // Prikazujemo izbor aduta

        // Ažuriraj bazu podataka
        await axios.post(
          `http://localhost:5000/api/rounds/${gameId}/update-hand`,
          {
            userId: user.id,
            newHand,
          }
        );

        // Emitujemo škart na server
        socket.emit("updateDiscard", {
          gameId,
          userId: user.id,
          discardedCards: selectedDiscard,
        });

        // Sakrivamo talon
        socket.emit("hideTalon", { gameId });

        console.log("Škart uspešno izvršen:", selectedDiscard);
      } catch (error) {
        console.error("Greška prilikom škarta:", error);
      }
    } else {
      alert("Morate izabrati tačno 2 karte za škart!");
    }
  };

  const isCardSelected = (selectedCards, card) => {
    return selectedCards.some(
      (selectedCard) =>
        selectedCard.suit === card.suit && selectedCard.value === card.value
    );
  };

  // Izračunaj currentPlayerId i isWinner
  let currentPlayerId = null;
  if (licitacija && licitacija.playerOrder) {
    const { currentPlayerIndex, playerOrder } = licitacija;
    currentPlayerId = playerOrder[currentPlayerIndex];
  }

  const isMyTurnToBid = currentPlayerId === user?.id;
  const isWinner = licitacija?.winnerId === user?.id;

  return (
    <div className="game-board">
      <div className="game-info">
        <h1>Game Board</h1>
        {licitacija ? (
          <>
            <h2>Adut: {trump || "Nije izabran"}</h2>
            <h3>Rezultati trenutne runde:</h3>
            <ul>
              {roundResults.map((res, index) => (
                <li key={index}>
                  Igrač {res.userId}: {res.score} poena
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>Čekamo još igrača za početak igre...</p>
        )}
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
      {talonVisible && !licitacija?.noTalon && (
        <Talon
          gameId={gameId}
          talonCards={talonCards}
          selectedDiscard={selectedDiscard}
          toggleDiscardCard={isWinner ? toggleDiscardCard : () => {}}
        />
      )}

      {/* Trenutna runda - ako prikazuješ karte na stolu */}
      <div className="current-round">
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
        toggleDiscardCard={toggleDiscardCard}
        isCardSelected={isCardSelected} // Dodato
        isWinner={isWinner}
        socket={socket}
      />

      {/* Izbor aduta - posle škarta */}
      {!talonVisible &&
        !adutSelected &&
        showAdutSelection &&
        !licitacija?.noTalon && (
          <Adut
            setTrump={(suit) => {
              setTrump(suit);
              setAdutSelected(true);
            }}
            gameId={gameId}
          />
        )}

      {/* Potvrdi škart dugme - samo za pobednika */}
      {talonVisible && isWinner && (
        <button className="confirm-discard" onClick={confirmDiscard}>
          Potvrdi škart
        </button>
      )}

      {/* Bacanje karata */}
      {/* {user && roundId && playerHand ? (
        <Bacanje
          socket={socket}
          user={user}
          roundId={roundId}
          hand={playerHand}
          setHand={setPlayerHand}
        />
      ) : (
        <p>Podaci se učitavaju ili korisnik nije prijavljen...</p>
      )} */}
    </div>
  );
};

export default GameBoard;
