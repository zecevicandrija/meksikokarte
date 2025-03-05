// index.js

const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const cors = require("cors");

require('dotenv').config();

// Konfigurisanje Cloudinary-ja
const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY,       
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Uvozimo naš pool iz db.js
const cron = require('node-cron');
const { promisePool } = require("./db"); // Koristimo promisePool iz mysql2

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "https://lively-bavarois-10c9a1.netlify.app/", // prilagoditi za drugaciji host
    methods: ["GET", "POST"],
    credentials: true
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// --------------------
// Učitavanje ruta

const paypalRoutes = require("./routes/paypal");
app.use("/api/paypal", paypalRoutes);

const toplistaRouter = require('./routes/toplista');
app.use('/api/toplista', toplistaRouter);

const gameRoutes = require("./routes/games");
app.use("/api/games", gameRoutes);

const istorijaRoutes = require("./routes/istorija");
app.use("/api/istorija", istorijaRoutes);

// После осталих рута
const googleRoutes = require('./routes/google');
app.use('/api/auth', googleRoutes);

const friendsRoutes = require("./routes/friends");
app.use("/api/friends", friendsRoutes);

const statsRoutes = require("./routes/stats");
app.use("/api/stats", statsRoutes);

const dostignucaRoutes = require("./routes/dostignuca");
app.use("/api/dostignuca", dostignucaRoutes);

const gamePlayersRoutes = require("./routes/gamePlayers");
app.use("/api/game-players", gamePlayersRoutes);

// roundsRoutes sada poziva funkciju i prosleđuje `io`
const roundsRoutes = require('./routes/rounds')(io);
app.use("/api/rounds", roundsRoutes);

const bacanjeRoutes = require("./routes/bacanje")(io); // Prosljeđivanje io
app.use("/api/bacanje", bacanjeRoutes);

const authRouter = require("./routes/auth");
const korisniciRouter = require("./routes/korisnici");
app.use("/api/auth", authRouter);
app.use("/api/korisnici", korisniciRouter);

const tokeniRouter = require('./routes/tokeni');
app.use("/api/tokeni", tokeniRouter);

// --------------------
// Pomoćne funkcije

// Funkcija za ažuriranje najbolji_mesec
const updateBestMonth = async () => {
  try {
    // Dohvati sve korisnike
    const [users] = await promisePool.query('SELECT id FROM korisnici');

    for (const user of users) {
      const userId = user.id;

      // Odredi datumski opseg za prethodni mesec
      const now = new Date();
      const firstDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfPreviousMonth = new Date(firstDayOfCurrentMonth - 1);
      const firstDayOfPreviousMonth = new Date(lastDayOfPreviousMonth.getFullYear(), lastDayOfPreviousMonth.getMonth(), 1);

      const formatDate = (date) => date.toISOString().slice(0, 19).replace('T', ' ');
      const startOfPreviousMonthStr = formatDate(firstDayOfPreviousMonth);
      const endOfPreviousMonthStr = formatDate(lastDayOfPreviousMonth);

      // Izračunaj ukupan skor za prethodni mesec
      const [scoreResults] = await promisePool.query(
        `SELECT COALESCE(SUM(gp.score), 0) AS totalScore
         FROM game_players gp
         JOIN games g ON gp.game_id = g.id
         WHERE gp.user_id = ?
           AND g.created_at >= ?
           AND g.created_at <= ?`,
        [userId, startOfPreviousMonthStr, endOfPreviousMonthStr]
      );

      const totalScorePreviousMonth = scoreResults[0].totalScore;

      // Dohvati trenutni najbolji_mesec
      const [bestMonthResults] = await promisePool.query(
        `SELECT najbolji_mesec
         FROM korisnici
         WHERE id = ?`,
        [userId]
      );

      const currentBestMonth = bestMonthResults[0].najbolji_mesec || 0;

      // Ako je skor prethodnog meseca veći, ažuriraj najbolji_mesec
      if (totalScorePreviousMonth > currentBestMonth) {
        await promisePool.query(
          `UPDATE korisnici
           SET najbolji_mesec = ?
           WHERE id = ?`,
          [totalScorePreviousMonth, userId]
        );
      }
    }

    console.log('Najbolji mesec uspešno ažuriran za sve korisnike.');
  } catch (err) {
    console.error('Greška pri ažuriranju najbolji_mesec:', err);
  }
};

// Zakazivanje cron job-a za 1. dan u mesecu u ponoć
cron.schedule('0 0 1 * *', () => {
  console.log('Pokrećem proveru i ažuriranje najbolji_mesec...');
  updateBestMonth();
}, {
  timezone: 'Europe/Belgrade' // Osigurava da radi po tvom vremenu
});



function sortDeck(deck) {
  const suitOrder = ["♠", "♥", "♦", "♣"];
  const valueOrder = ["A", "K", "Q", "J", "10", "9", "8", "7"];

  return deck.sort((a, b) => {
    const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
    if (suitDiff !== 0) return suitDiff;
    return valueOrder.indexOf(a.value) - valueOrder.indexOf(b.value);
  });
}

function generateDeck() {
  const suits = ["♠", "♥", "♦", "♣"];
  const values = ["7", "8", "9", "10", "J", "Q", "K", "A"];
  const deck = [];

  for (const suit of suits) {
    for (const value of values) {
      deck.push({
        suit,
        value,
        image: `/Slike/${value}_${
          suit === "♠"
            ? "spades"
            : suit === "♥"
            ? "hearts"
            : suit === "♦"
            ? "diamonds"
            : "clubs"
        }.png`,
      });
    }
  }

  // Pravilno mešanje
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

// Deljenje karata za 3 igrača (async/await verzija)
async function dealCardsToGame(gameId) {
  const deck = generateDeck();
  const playerHands = [
    deck.slice(0, 10),
    deck.slice(10, 20),
    deck.slice(20, 30),
  ];
  const talon = deck.slice(30, 32);

  try {
    const [players] = await promisePool.query(
      "SELECT id FROM game_players WHERE game_id = ? ORDER BY id ASC",
      [gameId]
    );

    if (players.length < 3) {
      throw new Error("Nema 3 igrača u igri. Ne mogu podeliti karte.");
    }

    // Ažuriranje ruku igrača
    const updates = players.map(async (player, index) => {
      const hand = JSON.stringify(playerHands[index]);
      await promisePool.query(
        "UPDATE game_players SET hand = ? WHERE id = ?",
        [hand, player.id]
      );
    });

    await Promise.all(updates);

    // Ažuriranje talona
    const talonJSON = JSON.stringify(talon);
    await promisePool.query(
      "UPDATE rounds SET talon_cards = ? WHERE game_id = ? ORDER BY id DESC LIMIT 1",
      [talonJSON, gameId]
    );

  } catch (error) {
    throw error;
  }
}

// Dohvata poslednju (aktivnu) rundu (async/await verzija)
async function getActiveRoundForGame(gameId) {
  try {
    const [results] = await promisePool.query(
      "SELECT * FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 1",
      [gameId]
    );
    return results.length > 0 ? results[0] : null;
  } catch (err) {
    throw err;
  }
}

// Ažuriranje polja "licitacija" u rounds (async/await verzija)
async function updateRoundLicitacija(roundId, newLicData) {
  const jsonLic = JSON.stringify(newLicData);
  await promisePool.query(
    "UPDATE rounds SET licitacija = ? WHERE id = ?",
    [jsonLic, roundId]
  );
}
// Definišite pomoćnu funkciju safeParse (možete je postaviti unutar io.on("connection"))
function safeParse(data) {
  if (data == null) return data;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error("Greška pri parsiranju JSON-a:", e);
      return data;
    }
  }
  return data;
}
// --------------------
// Socket.IO logika (adaptirana za async/await)
io.on("connection", (socket) => {
  console.log(`Korisnik povezan: ${socket.id}`);

  // 1) Event: joinGame
  socket.on("joinGame", async ({ gameId, userId }) => {
    if (!gameId || !userId) {
      console.error("Missing game or user ID");
      return;
    }
  
    socket.join(`game_${gameId}`);
    console.log(`User ${userId} joined game ${gameId}`);
  
    try {
      const [players] = await promisePool.query(
        "SELECT user_id FROM game_players WHERE game_id = ?",
        [gameId]
      );

      try {
        const [roundResults] = await promisePool.query(
          'SELECT current_active_player FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 1',
          [gameId]
        );
        if (roundResults.length > 0) {
          socket.emit('gameState', { currentActivePlayer: roundResults[0].current_active_player });
        }
      } catch (err) {
        console.error('Greška pri dohvatanju stanja igre:', err);
      }
      
      const playerIds = players.map(p => p.user_id);
      io.to(`game_${gameId}`).emit("playersUpdated", playerIds);
  
      if (playerIds.length === 3) {
        const [activeRounds] = await promisePool.query(
          "SELECT id FROM rounds WHERE game_id = ? AND finished = 0 ORDER BY id DESC LIMIT 1",
          [gameId]
        );
  
        if (activeRounds.length === 0) {
          console.log(`All players joined for game ${gameId}`);
          io.to(`game_${gameId}`).emit("allPlayersJoined");
        }
      }
    } catch (err) {
      console.error("Error fetching players", err);
    }
  });

  // Ako u igri ima 3 igrača => podeli karte
  let isDealing = false;
  async function checkAndDealIf3Players(gameId) {
    if (isDealing) return;
    isDealing = true;

    try {
      const [results] = await promisePool.query(
        "SELECT COUNT(*) AS cnt FROM game_players WHERE game_id = ?",
        [gameId]
      );

      isDealing = false;
      const playerCount = results[0].cnt;

      if (playerCount === 3) {
        console.log(`Igra ${gameId} sada ima 3 igrača. Delim karte...`);
        await dealCardsToGame(gameId);
        console.log(`Karte su uspešno podeljene za igru ${gameId}`);
        io.to(`game_${gameId}`).emit("cardsDealt", {
          message: "Karte su podeljene.",
        });
      }
    } catch (error) {
      isDealing = false;
      console.error(`Greška pri deljenju karata za igru ${gameId}:`, error);
    }
  }


  // 2) Event: playerBid => licitacija
socket.on("playerBid", async ({ roundId, userId, bid }) => {
  const gameId = roundId;

  try {
    const round = await getActiveRoundForGame(gameId);
    if (!round) {
      console.warn(`Nema aktivne runde za igru ${gameId}`);
      return;
    }

    let licData = safeParse(round.licitacija);
   
    if (!licData) {
      console.warn("Nema licitacija podataka u rounds.licitacija");
      return;
    }

    const {
      playerOrder = [],
      currentPlayerIndex = 0,
      bids = [],
      passedPlayers = [],
      minBid = 5,
    } = licData;

    const currentPlayerId = playerOrder[currentPlayerIndex] || null;
    if (!currentPlayerId) {
      console.warn("Nema currentPlayerId u licData");
      return;
    }

    // Provera da li je userId == currentPlayerId
    if (currentPlayerId !== userId) {
      console.log(`Igrač ${userId} nije na potezu. Trenutni je ${currentPlayerId}.`);
      return; // ignorisi
    }

    // Ako su već 2 igrača rekli "Dalje", 3. ne može reći "Dalje"
    if (passedPlayers.length === 2 && bid === "Dalje") {
      console.log("Treći igrač ne može reći Dalje ako su već dvojica rekla Dalje!");
      return;
    }

    // Obrada licitacije
    let newMinBid = minBid;
    if (bid === "Dalje") {
      if (!passedPlayers.includes(userId)) {
        passedPlayers.push(userId);
      }
    } else if (bid === "Meksiko") {
      // Set the bid value for the current player
      licData.bids = licData.bids || [];
      licData.bids[currentPlayerIndex] = 11;
      licData.minBid = 12;
      licData.finished = true;
      licData.winnerId = userId;
      licData.noTalon = true;
      licData.noTrump = true;

      // Update the round's licitacija in the database
      await updateRoundLicitacija(round.id, licData);

      // Emit the updated licitacija to clients
      io.to(`game_${gameId}`).emit("licitacijaUpdated", licData);

      // Update talon_cards to empty
      await promisePool.query(
        `UPDATE rounds 
         SET talon_cards = '[]' 
         WHERE game_id = ? 
         ORDER BY id DESC LIMIT 1`,
        [gameId]
      );

      // Emit events to hide talon and update hands
      io.to(`game_${gameId}`).emit("hideTalon");
      io.to(`game_${gameId}`).emit("updateTable", { gameId });

      // Determine the next player after the winner
      const playerOrder = licData.playerOrder || [];
      const winnerIndex = playerOrder.indexOf(userId);
      const nextPlayerId = playerOrder[0]; // Prvi igrač u playerOrder

      // Start the playing phase with the next player
      io.to(`game_${gameId}`).emit("nextPlayer", { nextPlayerId });

      return; // Prekidamo dalje izvršavanje jer je licitacija završena
    } else {
      const numericBid = parseInt(bid, 10) || 5;
      if (numericBid < minBid) {
        console.log(`Bid ${numericBid} < minBid ${minBid}. Nevalidno.`);
        return;
      }
      bids[currentPlayerIndex] = numericBid;
      newMinBid = numericBid + 1;
    }

    // Ponovo izračunaj activePlayers
    const allPlayers = playerOrder;
    const activePlayers = allPlayers.filter(
      (pid) => !passedPlayers.includes(pid)
    );

    // Glavna logika
    if (activePlayers.length === 1) {
      const maxPlayers = allPlayers.length;
      const lastPlayerId = activePlayers[0];
      const lastPlayerIndex = playerOrder.indexOf(lastPlayerId);
      const lastPlayerBid = bids[lastPlayerIndex];

      if (!lastPlayerBid) {
        let nextIndex = currentPlayerIndex;
        let attempts = 0;

        do {
          nextIndex = (nextIndex + 1) % maxPlayers;
          attempts++;
        } while (
          passedPlayers.includes(allPlayers[nextIndex]) && 
          attempts < maxPlayers * 2
        );

        licData.currentPlayerIndex = nextIndex;
      } else {
        licData.finished = true;
        licData.winnerId = activePlayers[0];
      }
    } else if (activePlayers.length === 0) {
      licData.finished = true;
      licData.winnerId = null;
    } else {
      const maxPlayers = allPlayers.length;
      let nextIndex = currentPlayerIndex;
      let attempts = 0;

      do {
        nextIndex = (nextIndex + 1) % maxPlayers;
        attempts++;
      } while (
        passedPlayers.includes(allPlayers[nextIndex]) && 
        attempts < maxPlayers * 2
      );

      if (passedPlayers.includes(allPlayers[nextIndex])) {
        licData.finished = true;
        licData.winnerId = activePlayers[0] || null;
      } else {
        licData.currentPlayerIndex = nextIndex;
      }
    }

    licData.minBid = newMinBid;
    licData.bids = bids;
    licData.passedPlayers = passedPlayers;
    licData.playerOrder = playerOrder;

    await updateRoundLicitacija(round.id, licData);

    // Emit
    io.to(`game_${gameId}`).emit("licitacijaUpdated", licData);

    if (licData.finished) {
  const playerOrder = licData.playerOrder || [];
  const nextPlayerId = playerOrder[0]; // Postavi na prvog igrača u playerOrder

  await promisePool.query(
    "UPDATE rounds SET current_active_player = ? WHERE id = ?",
    [nextPlayerId, round.id]
  );
  io.to(`game_${gameId}`).emit("nextPlayer", { nextPlayerId });
  io.to(`game_${gameId}`).emit("openTalon", { winnerId: licData.winnerId });
  console.log(`Licitacija završena. WinnerId=${licData.winnerId || "none"}`);
}

  } catch (error) {
    console.error("Greška u obradi licitacije:", error);
  }
});
  

  // Primer za "startTurn" event
socket.on("startTurn", ({ roundId, playerId }) => {
  console.log(`Početak poteza za igrača: ${playerId} u rundi: ${roundId}`);
  // Emituj događaj 'nextPlayer'
  io.to(`game_${roundId}`).emit("nextPlayer", { nextPlayerId: playerId });
});

// Kad klijent emit-uje 'cardsDealt'
socket.on("cardsDealt", (data) => {
  console.log("Primljeno podeljene karte:", data);
  // Ovde, ako treba, ažuriraj bazu, pa onda:
  io.to(`game_${data.gameId}`).emit("cardsDealt", data);
  // Tako svi klijenti u sobi "game_gameId" dobijaju event
});

// Primer za "cardPlayed" (async/await verzija)
socket.on("cardPlayed", async ({ roundId, playerId }) => {
  console.log(`Igrač ${playerId} je odigrao kartu u rundi: ${roundId}`);

  try {
    // Dohvati player_order iz runde
    const [results] = await promisePool.query(
      "SELECT player_order FROM rounds WHERE id = ?",
      [roundId]
    );

    if (results.length === 0) {
      console.error("Runda nije pronađena.");
      return;
    }

    const playerOrder = JSON.parse(results[0].player_order);
    const currentIndex = playerOrder.indexOf(playerId);

    // Proveri da li su svim igračima prazne ruke
    const [players] = await promisePool.query(
      "SELECT hand FROM game_players WHERE round_id = ?",
      [roundId]
    );

    const allHandsEmpty = players.every((p) => {
      try {
        const hand = JSON.parse(p.hand || "[]");
        return hand.length === 0;
      } catch {
        return false;
      }
    });

    if (allHandsEmpty) {
      // Kraj runde
      io.to(`game_${roundId}`).emit("roundEnded", { roundId });
      console.log(`Runda ${roundId} je završena.`);

      // Pokreni novu rundu
      await startNewRound(roundId);
    } else {
      // Ako runda nije gotova, odredi ko je sledeći
      const nextIndex = (currentIndex + 1) % playerOrder.length;
      const nextPlayerId = playerOrder[nextIndex];

      io.to(`game_${roundId}`).emit("nextPlayer", { nextPlayerId });
      console.log(`Sledeći igrač: ${nextPlayerId}`);
    }
  } catch (error) {
    console.error("Greška u cardPlayed eventu:", error);
  }
});

// Funkcija za pokretanje nove runde (async/await verzija)
async function startNewRound(gameId) {
  try {
    // Proveri da li su sve ruke prazne
    const [results] = await promisePool.query(
      "SELECT hand FROM game_players WHERE game_id = ?",
      [gameId]
    );

    const handsEmpty = results.every((p) => {
      const handArr = JSON.parse(p.hand || "[]");
      return handArr.length === 0;
    });

    if (!handsEmpty) {
      console.warn("Ne možemo započeti novu rundu, igrači još imaju karte.");
      return;
    }

    // Dohvati player_order iz poslednje runde
    const [roundRows] = await promisePool.query(
      "SELECT player_order FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 1",
      [gameId]
    );

    const playerOrder = roundRows.length
      ? JSON.parse(roundRows[0].player_order)
      : [];

    // Kreiraj inicijalnu licitaciju
    const licitacija = {
      playerOrder,
      currentPlayerIndex: 0,
      bids: [],
      minBid: 5,
      passedPlayers: [],
      finished: false,
    };

    // Insert nove runde
    const [insertResult] = await promisePool.query(
      "INSERT INTO rounds (game_id, player_order, licitacija) VALUES (?, ?, ?)",
      [gameId, JSON.stringify(playerOrder), JSON.stringify(licitacija)]
    );

    const newRoundId = insertResult.insertId;
    console.log(`Nova runda kreirana sa ID: ${newRoundId} za gameId=${gameId}`);

    // Resetuj hand-ove i dodeli novi round_id za igrače
    await promisePool.query(
      "UPDATE game_players SET round_id = ?, hand = '[]' WHERE game_id = ?",
      [newRoundId, gameId]
    );

    // Deli nove karte
    const deck = generateDeck();
    const playerHands = [
      deck.slice(0, 10),
      deck.slice(10, 20),
      deck.slice(20, 30),
    ];
    const talon = deck.slice(30, 32);

    // Ažuriraj hand za svakog igrača na osnovu playerOrder-a
    const updates = playerHands.map(async (hand, index) => {
      await promisePool.query(
        "UPDATE game_players SET hand = ? WHERE id = ?",
        [JSON.stringify(hand), playerOrder[index]]
      );
    });

    await Promise.all(updates);
    console.log("Ruke uspešno ažurirane za sve igrače.");

    // Ažuriraj talon u rounds
    await promisePool.query(
      "UPDATE rounds SET talon_cards = ? WHERE id = ?",
      [JSON.stringify(talon), newRoundId]
    );

    console.log(`Talon uspešno ažuriran za rundu ${newRoundId}`);

    // Emituj "newRound" svim klijentima
    io.to(`game_${gameId}`).emit("newRound", {
      roundId: newRoundId,
      playerOrder,
    });

    console.log(`Nova runda ${newRoundId} je startovana.`);

  } catch (error) {
    console.error("Greška u startNewRound:", error);
  }
}

// 3) Diskonekt
socket.on("disconnect", () => {
  console.log(`Korisnik se odvojio: ${socket.id}`);
});
});
// --------------------
// Pokretanje servera
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server pokrenut na portu ${PORT}`);
});