import React, { useState, useEffect } from "react";
import axios from "axios";
import io from "socket.io-client";
import PlayerHand from "./PlayerHand";
import Talon from "./Talon";
import Licitacija from "./Licitacija";
import "../Styles/GameBoard.css";
import Adut from "./Adut";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../Login/AuthContext";
import PlayerProfile from "./PlayerProfile";
import backgroundslika2 from '../Slike/roundtablebg.png'; // Samo korišćeni importi
import pngtable2 from '../Slike/roundtablepng.png';
import blackpozadina from '../Slike/blackpozadina.jpg'

// Socket.IO konekcija
const socket = io("http://localhost:5000", {
  withCredentials: true,
  transports: ["websocket", "polling"],
  auth: { token: localStorage.getItem('authToken') }
});

const GameBoard = () => {
  const navigate = useNavigate();
  const { user, updateTokens } = useAuth();
  const { gameId } = useParams();

  // Stanja
  const [playerHand, setPlayerHand] = useState([]);
  const [talonCards, setTalonCards] = useState([]);
  const [selectedDiscard, setSelectedDiscard] = useState([]);
  const [currentRound, setCurrentRound] = useState([]);
  const [talonVisible, setTalonVisible] = useState(false);
  const [canDiscard, setCanDiscard] = useState(false);
  const [loading, setLoading] = useState(true);
  const [discardConfirmed, setDiscardConfirmed] = useState(false);
  const [activePlayerId, setActivePlayerId] = useState(null);
  const [turnPlayed, setTurnPlayed] = useState(false);
  const [adutSelected, setAdutSelected] = useState(false);
  const [showAdutSelection, setShowAdutSelection] = useState(false);
  const [trump, setTrump] = useState(null);
  const [roundId, setRoundId] = useState(null);
  const [licitacija, setLicitacija] = useState(null);
  const [scores, setScores] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [winnerId, setWinnerId] = useState(null);
  const [userData, setUserData] = useState({});
  const [isClearing, setIsClearing] = useState(false);

  // Pomoćne funkcije
  const getPlayerPosition = (playerIndex, currentPlayerIndex) => {
    const totalPlayers = 3;
    const diff = (playerIndex - currentPlayerIndex + totalPlayers) % totalPlayers;
    return diff === 1 ? "right" : diff === 2 ? "left" : "";
  };

  const currentPlayerIndex = licitacija?.playerOrder?.indexOf(user?.id) ?? -1;
  const opponents = licitacija?.playerOrder?.filter(id => id !== user?.id) ?? [];

  // Konsolidovani useEffect za inicijalizaciju i socket listenere
  useEffect(() => {
    if (!user || !user.id) {
      console.warn("Korisnik nije definisan.");
      return;
    }

    const initialize = async () => {
      setLoading(true);
      try {
        await fetchGameData();
        socket.emit("joinGame", { gameId, userId: user.id });
      } finally {
        setLoading(false);
      }
    };
    initialize();

    // Socket event listeneri
    const handleLicitacijaUpdated = (data) => {
      setLicitacija(data);
      setTalonVisible(data?.finished || false);
    };

    const handleAllPlayersJoined = () => startRound();

    const handleCardsDealt = () => {
      fetchPlayerHand();
      fetchGameData();
    };

    const handleTrumpUpdated = (adut) => setTrump(adut);

    const handleHandUpdated = ({ userId, newHand }) => {
      if (userId === user.id) setPlayerHand(sortHand(newHand));
    };

    const handleHideTalon = () => setTalonVisible(false);

    const handleNewRound = async ({ roundId, playerOrder }) => {
      setDiscardConfirmed(false);
      setTalonVisible(false);
      setAdutSelected(false);
      setShowAdutSelection(false);
      setSelectedDiscard([]);
      await fetchGameData();
    };

    const handleCardPlayed = (data) => {
      setCurrentRound(prev => {
        const nextRound = [...prev, {
          card_value: data.cardValue,
          card_suit: data.cardSuit,
          image: data.image
        }];
        if (nextRound.length === 3 && data.playerId === user.id) {
          axios.post(`http://localhost:5000/api/bacanje/${gameId}/resolveTurn`)
            .catch(err => console.error("Greška pri pozivu resolveTurn:", err));
        }
        return nextRound;
      });
      setActivePlayerId(parseInt(data.nextPlayerId, 10) || null);
      setTurnPlayed(false);
    };

    const handleNextTurn = ({ nextPlayerId }) => {
      setActivePlayerId(nextPlayerId);
      if (nextPlayerId === user.id) setTurnPlayed(false);
    };

    const handleClearTable = ({ winnerId }) => {
      setIsClearing(true);
      setLicitacija(prev => ({ ...prev, winnerId }));
    };

    const handleSyncTable = ({ currentRound, nextPlayerId }) => {
      setCurrentRound(currentRound);
      setActivePlayerId(nextPlayerId);
    };

    const handleUpdateTable = async ({ roundId, gameId }) => {
      try {
        const res = await axios.get(`http://localhost:5000/api/rounds/${gameId}`);
        const { roundId: updatedRoundId, talonCards, playerHands } = res.data;
        await fetchGameData();
        setRoundId(updatedRoundId || null);
        setTalonCards(talonCards || []);
        if (playerHands && user) {
          const myHand = playerHands.find(p => p.userId === user.id)?.hand || [];
          setPlayerHand(sortHand(myHand));
        }
      } catch (err) {
        console.error("Greška pri osvežavanju table:", err);
      }
    };

    const handleScoreUpdated = () => fetchGameData();

    const handlePenaltyApplied = ({ userId, penalty }) => {
      console.log(`Igrač ${userId} dobio penal: -${penalty}`);
      fetchGameData();
    };

    const handleRoundEnded = () => console.log("Runda završena.");

    const handleGameOver = async ({ winnerId, scores }) => {
      setGameOver(true);
      setWinnerId(winnerId);
      setScores(scores);
    
      // Osveži tokene
      try {
        if (user?.id) {
          await updateTokens(user.id); // Ažuriraj tokene korisnika
        }
      } catch (error) {
        console.error("Greška pri ažuriranju tokena:", error);
      }
    };

    // Registracija listenera
    socket.on("licitacijaUpdated", handleLicitacijaUpdated);
    socket.on("allPlayersJoined", handleAllPlayersJoined);
    socket.on("cardsDealt", handleCardsDealt);
    socket.on("trumpUpdated", handleTrumpUpdated);
    socket.on("handUpdated", handleHandUpdated);
    socket.on("hideTalon", handleHideTalon);
    socket.on("newRound", handleNewRound);
    socket.on("cardPlayed", handleCardPlayed);
    socket.on("nextTurn", handleNextTurn);
    socket.on("clearTable", handleClearTable);
    socket.on("syncTable", handleSyncTable);
    socket.on("updateTable", handleUpdateTable);
    socket.on("scoreUpdated", handleScoreUpdated);
    socket.on("penaltyApplied", handlePenaltyApplied);
    socket.on("roundEnded", handleRoundEnded);
    socket.on("gameOver", handleGameOver);
    socket.on("gameState", (data) => {
      setActivePlayerId(data.currentActivePlayer);
    });

    // Cleanup
    return () => {
      socket.emit("leaveGame", { gameId, userId: user.id });
      socket.off("licitacijaUpdated", handleLicitacijaUpdated);
      socket.off("allPlayersJoined", handleAllPlayersJoined);
      socket.off("cardsDealt", handleCardsDealt);
      socket.off("trumpUpdated", handleTrumpUpdated);
      socket.off("handUpdated", handleHandUpdated);
      socket.off("hideTalon", handleHideTalon);
      socket.off("newRound", handleNewRound);
      socket.off("cardPlayed", handleCardPlayed);
      socket.off("nextTurn", handleNextTurn);
      socket.off("clearTable", handleClearTable);
      socket.off("syncTable", handleSyncTable);
      socket.off("updateTable", handleUpdateTable);
      socket.off("scoreUpdated", handleScoreUpdated);
      socket.off("penaltyApplied", handlePenaltyApplied);
      socket.off("roundEnded", handleRoundEnded);
      socket.off("gameOver", handleGameOver);
      socket.off("gameState")
    };
  }, [gameId, user]);

  // useEffect za čišćenje runde
  useEffect(() => {
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    async function clearRoundWithDelay() {
      if (currentRound.length === 3) {
        await delay(200);
        setCurrentRound([]);
        setIsClearing(false);
      }
    }
    clearRoundWithDelay();
  }, [currentRound]);

  // useEffect za pokretanje poteza
  useEffect(() => {
    if (adutSelected && licitacija?.finished) {
      socket.emit("startTurn", {
        roundId: gameId,
        playerId: licitacija.winnerId
      });
    }
  }, [adutSelected, licitacija, gameId]);

  // useEffect za dohvatanje podataka o korisnicima
  useEffect(() => {
    const fetchUserData = async () => {
      const newUserData = {};
      for (const score of scores) {
        try {
          const response = await axios.get(`http://localhost:5000/api/korisnici/${score.userId}`);
          newUserData[score.userId] = response.data;
        } catch (error) {
          newUserData[score.userId] = { ime: 'Nepoznat', prezime: 'Korisnik' };
        }
      }
      setUserData(newUserData);
    };
    if (scores.length > 0) fetchUserData();
  }, [scores]);

  // Funkcije
  const fetchGameData = async () => {
    if (!user || !user.id) return;
    try {
      const res = await axios.get(`http://localhost:5000/api/rounds/${gameId}`);
      const { roundId, talonCards, licitacija, playerHands, adut, currentActivePlayer } = res.data;
      setRoundId(roundId || null);
      setTalonCards(talonCards || []);
      setLicitacija(licitacija || {});
      setTrump(adut || null);
      setActivePlayerId(currentActivePlayer); // Dodato
      // Proveri da li postoji current_active_player, ako ne, postavi prvi u playerOrder
  if (!currentActivePlayer && licitacija?.playerOrder?.length > 0) {
    setActivePlayerId(licitacija.playerOrder[0]);
    // Ažuriraj i u bazi ako je potrebno
    await axios.post(`http://localhost:5000/api/rounds/${gameId}/force-active-player`, {
      playerId: licitacija.playerOrder[0]
    });
  }
      const newScores = playerHands?.map(p => ({ userId: p.userId, score: p.score })) ?? [];
      setScores(newScores);
      const myHand = playerHands?.find(p => p.userId === user.id)?.hand || [];
      setPlayerHand(sortHand(myHand));
    } catch (err) {
      if (err.response?.status === 404) {
        console.warn("Runda nije pronađena.");
      } else {
        console.error("Greška pri dohvatanju podataka o igri:", err);
      }
      setPlayerHand([]);
    }
  };

  const startRound = async () => {
    try {
      const res = await axios.post(`http://localhost:5000/api/rounds/${gameId}/start-round`);
      if (res.data.message === "Čeka se još igrača.") {
        console.warn("Nema dovoljno igrača za rundu.");
        return;
      }
      if (res.data.message === "Aktivna runda već postoji") {
        console.log("Koristi postojeću rundu:", res.data.roundId);
      }
      await fetchGameData();
    } catch (err) {
      console.error("Greška pri startu runde:", err);
    }
  };

  const fetchPlayerHand = async () => {
    if (!user?.id) return;
    try {
      const res = await axios.get(`http://localhost:5000/api/games/${gameId}/player/${user.id}/hand`);
      setPlayerHand(res.data.hand ? sortHand(res.data.hand) : []);
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

  const toggleDiscardCard = (card) => {
    if (selectedDiscard.some(c => c.suit === card.suit && c.value === card.value)) {
      setSelectedDiscard(selectedDiscard.filter(c => c.suit !== card.suit || c.value !== card.value));
    } else if (selectedDiscard.length < 2) {
      setSelectedDiscard([...selectedDiscard, card]);
    } else {
      alert("Možete odabrati najviše 2 karte za škart!");
    }
  };

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
      const remainingCards = combinedCards.filter(c => !selectedDiscard.some(d => d.suit === c.suit && d.value === c.value));
      const newHand = sortHand(remainingCards.slice(0, 10));
      setPlayerHand(newHand);
      setTalonCards([]);
      setSelectedDiscard([]);
      setTalonVisible(false);
      setCanDiscard(false);
      setDiscardConfirmed(true);
      setShowAdutSelection(true);
      await axios.post(`http://localhost:5000/api/rounds/${gameId}/update-hand`, {
        userId: user.id,
        newHand
      });
      socket.emit("updateDiscard", { gameId, userId: user.id, discardedCards: selectedDiscard });
      socket.emit("hideTalon", { gameId });
    } catch (error) {
      console.error("Greška prilikom škarta:", error);
    }
  };

  const isCardSelected = (selectedCards, card) => {
    return selectedCards.some(c => c.suit === card.suit && c.value === card.value);
  };

  const currentPlayerId = licitacija?.playerOrder?.[licitacija.currentPlayerIndex] ?? null;
  const isMyTurnToBid = currentPlayerId === user?.id;
  const isWinner = licitacija?.winnerId === user?.id;

  const pocetnaHandler = () => navigate("/pocetna");

  if (!user) return <div>Loading...</div>;

  return (
    <div className="game-board">
      <img src={blackpozadina} alt="pozadina" className="pozadina"/>
      <img src={pngtable2} alt="pozadina" className="stozaigru"/>
      <div className="game-info">
        {gameOver ? (
          <div className="game-over">
            <h2>Igra je gotova!</h2>
            <p>Pobednik je igrač {winnerId} sa {scores.find(s => s.userId === winnerId)?.score} poena!</p>
            <div className="final-scores">
              <h3>Konačni rezultati:</h3>
              {scores.map((score, index) => (
                <p key={index}>
                  {userData[score.userId]?.ime} {userData[score.userId]?.prezime}: {score.score}
                  {score.penalty && ` (penal -${score.penalty})`}
                </p>
              ))}
              <p onClick={pocetnaHandler}>Vrati se na glavni meni</p>
            </div>
          </div>
        ) : (
          <>
            <h2>Adut: {trump || "Nije izabran"}</h2>
            <div className="current-scores">
              <h3>Trenutni rezultati:</h3>
              {scores.map((score, index) => (
                <p key={index}>
                  {userData[score.userId]?.ime} {userData[score.userId]?.prezime}: {score.score}
                  {score.penalty && ` (penal -${score.penalty})`}
                </p>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Licitacija */}
      {!licitacija ? (
        <p style={{ margin: "20px" }}>Licitacija trenutno nije pokrenuta...</p>
      ) : licitacija.finished ? (
        <p className="licitacijanone" style={{ margin: "20px" }}>Licitacija je završena!</p>
      ) : isMyTurnToBid ? (
        <Licitacija socket={socket} roundId={gameId} licitacija={licitacija} user={user} />
      ) : (
        <p style={{ margin: "20px", color: "white" }}>
          Čekam da igrač {currentPlayerId} završi licitaciju...
        </p>
      )}

      {/* Talon + Škart */}
      {talonVisible && licitacija?.finished && !licitacija?.noTalon && (
        <Talon gameId={gameId} talonCards={talonCards} selectedDiscard={selectedDiscard}
          toggleDiscardCard={isWinner ? toggleDiscardCard : () => {}} />
      )}

      <div className="table-container">
        <div className="current-round">
          {opponents.map((playerId) => {
            const pos = getPlayerPosition(licitacija.playerOrder.indexOf(playerId), currentPlayerIndex);
            return (
              <div key={playerId} className={`opponent-profile ${pos}`}>
                <PlayerProfile userId={playerId} />
              </div>
            );
          })}

          <div className="cards">
            {currentRound.map((card, index) => (
              <div key={index} className="card">
                <img src={card.image} alt={`${card.value} ${card.suit}`} />
              </div>
            ))}
          </div>
        </div>

        <PlayerHand hand={playerHand} setHand={setPlayerHand} setTalonCards={setTalonCards}
          selectedDiscard={selectedDiscard} toggleDiscardCard={toggleDiscardCard}
          isCardSelected={isCardSelected} isWinner={isWinner} socket={socket}
          discardConfirmed={discardConfirmed} talonVisible={talonVisible}
          setLicitacija={setLicitacija} activePlayerId={activePlayerId}
          currentRound={currentRound} trumpSuit={trump} licitacija={licitacija}
          isClearing={isClearing} />

        <div className="current-player-profile">
          <PlayerProfile userId={user.id} />
        </div>
      </div>

      {!talonVisible && !adutSelected && showAdutSelection && !licitacija?.noTalon && (
        <Adut setTrump={(suit) => { setTrump(suit); setAdutSelected(true); }} gameId={gameId} />
      )}

      <div className="skartcontainer">
        {talonVisible && isWinner && (
          <button className="confirm-discard" onClick={confirmDiscard}>Potvrdi škart</button>
        )}
      </div>
    </div>
  );
};

export default GameBoard;