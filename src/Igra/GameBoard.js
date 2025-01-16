import React, { useState, useEffect, use } from "react";
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
  const [discardConfirmed, setDiscardConfirmed] = useState(false);

  const [activePlayerId, setActivePlayerId] = useState(null);
  const [turnPlayed, setTurnPlayed] = useState(false);

  const [adutSelected, setAdutSelected] = useState(false);
  const [showAdutSelection, setShowAdutSelection] = useState(false);
  const [trump, setTrump] = useState(null);
  const [roundId, setRoundId] = useState(null);
  const [licitacija, setLicitacija] = useState(null);

  const startNewRound = async () => {
    try {
      const newRoundResponse = await axios.post(
        `http://localhost:5000/api/rounds/${gameId}/newRound`
      );
      console.log("startNewRound odgovor:", newRoundResponse.data)

      await fetchGameData();

    } catch (error) {
      console.error("Greška pri pokretanju nove runde:", error);
    }
  };

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
      console.log("Svi igrači su se pridružili...");
      // UMESTO newRound:
      startRound();
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

  
  useEffect(() => {
    fetchGameData();
  }, [gameId]);

  useEffect(() => {
    if (!roundId) {
      console.log("Nema roundId, kreiramo prvu rundu...");
      startRound();
    }
  }, [roundId]);

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
    if (!socket) return;
  
    const handleNewRound = async ({ roundId, playerOrder }) => {
      console.log("Nova runda primljena:", roundId, playerOrder);
  
      // setLicitacija(null); // Reset licitacije
      // setTrump(null); // Reset aduta
      // setTalonCards([]); // Reset talona
      // setCurrentRound([]); // Reset trenutne runde | iskomentariso sam sve ovo da pustim fetchgamedata sve da uradi vraticemo posle ako treba
  
      await fetchGameData(); // Ažuriraj podatke iz baze
    };
  
    socket.on("newRound", handleNewRound);
  
    return () => {
      socket.off("newRound", handleNewRound);
    };
  }, [socket]);
  

  useEffect(() => {
    if (adutSelected && licitacija?.finished) {
      socket.emit("startTurn", {
        roundId: gameId,
        playerId: licitacija.winnerId,
      });
    }
  }, [adutSelected, licitacija, gameId, socket]);

  useEffect(() => {
    // 1) Kad se karta baci
    socket.on("cardPlayed", (data) => {
      setCurrentRound((prev) => {
        const nextRound = [
          ...prev,
          {
            card_value: data.cardValue,
            card_suit: data.cardSuit,
            image: data.image,
          },
        ];
    
        // Ako ima 3 karte na stolu, pozovi resolveTurn
        if (nextRound.length === 3) {
          console.log("Na stolu su 3 karte. Pozivam resolveTurn...");
          axios
            .post(`http://localhost:5000/api/bacanje/${gameId}/resolveTurn`)
            .then((res) => {
              console.log("resolveTurn uspešno pozvan:", res.data);
            })
            .catch((err) => {
              console.error("Greška pri pozivu resolveTurn:", err);
            });
        }
    
        return nextRound;
      });
    
      const forcedId = parseInt(data.nextPlayerId, 10);
      setActivePlayerId(Number.isNaN(forcedId) ? null : forcedId);
      setTurnPlayed(false);
      console.log("Sledeći igrač na potezu:", forcedId);
    });
    
    // 2) Kad server javi "sledeći igrač je nextPlayerId"
    socket.on("nextTurn", ({ nextPlayerId }) => {
      console.log("Next turn for player:", nextPlayerId);
      setActivePlayerId(nextPlayerId);
      console.log("Ažuriran activePlayerId na:", activePlayerId);
      if (activePlayerId === user.id) {
        setTurnPlayed(false); // Aktiviraj akcije za trenutnog igrača
      } else {
        console.log("Čekam svoj red...");
      }
    });

    // 3) Kad se tabla briše
    socket.on("clearTable", ({ winnerId }) => {
      console.log("clearTable događaj primljen. Pobednik je:", winnerId);
    
      // Provera trenutnog stanja
      console.log("Pre clearTable, stanje currentRound:", currentRound);
    
      // Ažuriranje stanja
      setCurrentRound([]);
    
      // Provera nakon ažuriranja
      console.log("Nakon clearTable, stanje currentRound:", currentRound);
    
      // Ažuriraj licitaciju sa pobednikom
      setLicitacija((prev) => {
        console.log("Ažuriram licitaciju sa pobednikom:", winnerId);
        return { ...prev, winnerId };
      });
    });

    
    socket.on("syncTable", ({ currentRound, nextPlayerId }) => {
      console.log("syncTable događaj primljen:", currentRound, nextPlayerId);
      setCurrentRound(currentRound); // Ažurira stanje stola
      setActivePlayerId(nextPlayerId); // Postavlja sledećeg igrača na potezu
    });

    return () => {
      console.log("Uklanjam listener za clearTable");
      socket.off("cardPlayed");
      socket.off("nextTurn");
      socket.off("clearTable");
      socket.off("syncTable");
    };
  }, [socket, currentRound]);


  useEffect(() => {
    if (!socket) return;
  
    const handleUpdateTable = async ({ roundId, gameId }) => {
      try {
        const res = await axios.get(`http://localhost:5000/api/rounds/${gameId}`);
        const { roundId: updatedRoundId, talonCards, playerHands } = res.data;
  
        setRoundId(updatedRoundId || null);
        setTalonCards(talonCards || []);
  
        if (playerHands && user) {
          const myHand = playerHands.find((p) => p.userId === user.id)?.hand || [];
          setPlayerHand(sortHand(myHand));
        }
      } catch (err) {
        console.error("Greška pri osvežavanju table:", err);
      }
    };
  
    socket.on("updateTable", handleUpdateTable);
  
    return () => {
      socket.off("updateTable", handleUpdateTable);
    };
  }, [socket, user]);
  

  useEffect(() => {
    if (!socket) {
      console.error("Socket nije inicijalizovan!");
      return;
    }

    socket.on("roundEnded", async () => {
      console.log("Round has ended. Starting a new round...");
      await startNewRound();
    });
  
    return () => {
      socket.off("roundEnded");
    };
  }, [socket, gameId]);
  
  

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
    try {
      const res = await axios.post(
        `http://localhost:5000/api/rounds/${gameId}/start-round`
      );
      console.log("startRound response:", res.data);

      if (res.data.message === "Čeka se još igrača.") {
        console.warn("Nema dovoljno igrača za prvu rundu.");
        return;
      }
      if (res.data.message === "Runda već postoji.") {
        console.warn("Već postoji runda, prelazim na fetchGameData...");
      }
      // Kad se runda uspešno kreira, dohvatite sve podatke
      await fetchGameData();
    } catch (err) {
      console.error("Greška pri startu runde:", err);
    }
  };

  // const dealCards = async () => {
  //   if (talonCards && talonCards.length > 0) {
  //     console.log("Karte su već podeljene. Preskačem dealCards.");
  //     return;
  //   }

  //   try {
  //     const response = await axios.post(
  //       `http://localhost:5000/api/rounds/${gameId}/deal`
  //     );
  //     console.log("Karte su uspešno podeljene:", response.data);

  //     // Emitovanje događaja
  //     socket.emit("cardsDealt", { message: "Karte su podeljene." }, (ack) => {
  //       if (ack.success) {
  //         console.log("Karte su uspešno ažurirane.");
  //       } else {
  //         console.error("Greška pri emitovanju cardsDealt:", ack.error);
  //       }
  //     });

  //     // Dohvati podatke o igri da osvežiš stanje
  //     await fetchGameData();
  //   } catch (error) {
  //     console.error(
  //       "Greška prilikom deljenja karata:",
  //       error.response?.data || error.message
  //     );
  //   }
  // };

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
    if (discardConfirmed) {
      alert("Škartiranje je već potvrđeno!");
      return;
    }

    if (selectedDiscard.length !== 2) {
      alert("Morate izabrati tačno 2 karte za škart!");
      return;
    }

    try {
      const combinedCards = [...playerHand, ...talonCards];
      const remainingCards = combinedCards.filter(
        (c) =>
          !selectedDiscard.some((d) => d.suit === c.suit && d.value === c.value)
      );

      const newHand = sortHand(remainingCards.slice(0, 10));

      setPlayerHand(newHand);
      setTalonCards([]);
      setSelectedDiscard([]);
      setTalonVisible(false);
      setCanDiscard(false);
      setDiscardConfirmed(true); // Blokiraj dalji škart
      setShowAdutSelection(true);

      await axios.post(
        `http://localhost:5000/api/rounds/${gameId}/update-hand`,
        {
          userId: user.id,
          newHand,
        }
      );

      socket.emit("updateDiscard", {
        gameId,
        userId: user.id,
        discardedCards: selectedDiscard,
      });

      socket.emit("hideTalon", { gameId });
      console.log("Škart uspešno izvršen:", selectedDiscard);
    } catch (error) {
      console.error("Greška prilikom škarta:", error);
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
  console.log("user.id =", user?.id, typeof user?.id);
  console.log("activePlayerId =", activePlayerId, typeof activePlayerId);

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
        discardConfirmed={discardConfirmed}
        talonVisible={talonVisible}
        setLicitacija={setLicitacija}
        activePlayerId={activePlayerId}
        currentRound={currentRound}
        trumpSuit={trump}
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

      <div className="played-cards-field">
        <h3>Karte na stoluuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu:</h3>
        <div className="cards">
          {currentRound.map((card, index) => (
            <div key={index} className="card">
              <img
                src={card.image}
                alt={`${card.card_value} ${card.card_suit}`}
              />
              <p>
                {card.card_value} {card.card_suit}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GameBoard;
