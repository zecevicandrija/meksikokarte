// index.js

const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const cors = require("cors");

// Uvozamo naš pool iz db.js
const db = require("./db"); // Tvoj fajl gde je createPool

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "http://localhost:3000", // ovde prilagodi ako ti treba neka druga adresa
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// --------------------
// Učitavanje ruta
const gameRoutes = require("./routes/games");
app.use("/api/games", gameRoutes);
app.use("/api", gameRoutes);

const gamePlayersRoutes = require("./routes/gamePlayers");
app.use("/api/game-players", gamePlayersRoutes);

// roundsRoutes sada poziva funkciju i prosleđuje `io`
const roundsRoutes = require("./routes/rounds")(io);
app.use("/api/rounds", roundsRoutes);

const bacanjeRoutes = require("./routes/bacanje")(io); // Prosljeđivanje io
app.use("/api/bacanje", bacanjeRoutes);

const authRouter = require("./routes/auth");
const korisniciRouter = require("./routes/korisnici");
app.use("/api/auth", authRouter);
app.use("/api/korisnici", korisniciRouter);

// --------------------
// Pomoćne funkcije

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
        // putanja do slike je primer, prilagodi je svom projektu po potrebi
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

  // Promešamo špil
  return deck.sort(() => Math.random() - 0.5);
}

// Deljenje karata za 3 igrača
function dealCardsToGame(gameId) {
  return new Promise((resolve, reject) => {
    const deck = generateDeck(); // Kreira špil karata (32 karte)
    const playerHands = [
      deck.slice(0, 10),
      deck.slice(10, 20),
      deck.slice(20, 30),
    ];
    const talon = deck.slice(30, 32);

    db.query(
      "SELECT id FROM game_players WHERE game_id = ? ORDER BY id ASC",
      [gameId],
      (err, players) => {
        if (err) return reject(err);
        if (players.length < 3) {
          return reject("Nema 3 igrača u igri. Ne mogu podeliti karte.");
        }

        // Za svakog igrača ažuriramo polje "hand"
        const updates = players.map((player, index) => {
          const hand = JSON.stringify(playerHands[index]);
          return new Promise((res, rej) => {
            db.query(
              "UPDATE game_players SET hand = ? WHERE id = ?",
              [hand, player.id],
              (updErr) => (updErr ? rej(updErr) : res())
            );
          });
        });

        Promise.all(updates)
          .then(() => {
            // Ažurira talon u rounds
            const talonJSON = JSON.stringify(talon);
            db.query(
              "UPDATE rounds SET talon_cards = ? WHERE game_id = ? ORDER BY id DESC LIMIT 1",
              [talonJSON, gameId],
              (updErr) => {
                if (updErr) {
                  return reject(updErr);
                }
                resolve(); // Sve je uspešno završeno
              }
            );
          })
          .catch(reject);
      }
    );
  });
}

// Dohvata poslednju (aktivnu) rundu
function getActiveRoundForGame(gameId, callback) {
  db.query(
    "SELECT * FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 1",
    [gameId],
    (err, results) => {
      if (err) return callback(err);
      if (results.length === 0) return callback(null, null); // nema runde
      callback(null, results[0]);
    }
  );
}

// Ažuriranje polja "licitacija" u rounds
function updateRoundLicitacija(roundId, newLicData, callback) {
  const jsonLic = JSON.stringify(newLicData);
  db.query("UPDATE rounds SET licitacija = ? WHERE id = ?", [jsonLic, roundId], (err) => {
    callback(err);
  });
}

// --------------------
// Socket.IO logika
io.on("connection", (socket) => {
  console.log(`Korisnik povezan: ${socket.id}`);

  // 1) Event: joinGame => igrač se pridružuje sobi "game_{gameId}"
  socket.on("joinGame", ({ gameId, userId }) => {
    if (!gameId || !userId) {
      console.error("Nedostaju podaci: gameId ili userId");
      return;
    }
    socket.join(`game_${gameId}`);
    console.log(`Korisnik ${userId} se pridružio igri ${gameId}`);

    // Emitujemo trenutni broj igrača svim klijentima u sobi
    db.query(
      "SELECT user_id FROM game_players WHERE game_id = ?",
      [gameId],
      (err, results) => {
        if (err) {
          console.error("Greška pri dohvatanju igrača:", err);
          return;
        }

        const players = results.map((row) => row.user_id);
        io.to(`game_${gameId}`).emit("playersUpdated", players);

        // Provera da li ima 3 igrača i deljenje karata
        if (players.length === 3) {
          console.log(`Igra ${gameId} sada ima 3 igrača. Delim karte...`);
          io.to(`game_${gameId}`).emit("allPlayersJoined");
        }
      }
    );
  });

  // Ako u igri ima 3 igrača => podeli karte
  function checkAndDealIf3Players(gameId) {
    db.query(
      "SELECT COUNT(*) AS cnt FROM game_players WHERE game_id = ?",
      [gameId],
      (err, results) => {
        if (err) {
          console.error("Greška prilikom brojanja igrača:", err);
          return;
        }
        const playerCount = results[0].cnt;
        if (playerCount === 3) {
          console.log(`Igra ${gameId} sada ima 3 igrača. Delim karte...`);
          dealCardsToGame(gameId)
            .then(() => {
              console.log(`Karte su uspešno podeljene za igru ${gameId}`);
              io.to(`game_${gameId}`).emit("cardsDealt", {
                message: "Karte su podeljene.",
              });
            })
            .catch((error) => {
              console.error(`Greška pri deljenju karata za igru ${gameId}:`, error);
            });
        }
      }
    );
  }

  // 2) Event: playerBid => licitacija
  socket.on("playerBid", ({ roundId, userId, bid }) => {
    const gameId = roundId; // možda je roundId=gameId, ili ih pomešaš — prilagodi po potrebi
  
    getActiveRoundForGame(gameId, (err, round) => {
      if (err) {
        console.error("Greška pri dohvatu runde:", err);
        return;
      }
      if (!round) {
        console.warn(`Nema aktivne runde za igru ${gameId}`);
        return;
      }
  
      let licData = null;
      try {
        licData = round.licitacija ? JSON.parse(round.licitacija) : null;
      } catch (parseErr) {
        console.error("Ne mogu da parse-ujem licitacija JSON:", parseErr);
        return;
      }
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
  
      // Ako su već 2 igrača rekli "Dalje", 3. ne može reći "Dalje" (zavisi od tvojih pravila)
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
      } else {
        // Ako je "Meksiko" => 11
        let numericBid = bid === "Meksiko" ? 11 : parseInt(bid, 10) || 5;
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
  // Proveri da li preostali igrač ima validnu ponudu
  const lastPlayerId = activePlayers[0];
  const lastPlayerIndex = playerOrder.indexOf(lastPlayerId);
  const lastPlayerBid = bids[lastPlayerIndex];

  // Ako igrač NIJE dao ponudu (svi su pass-ovali pre nego što je on išta licitirao)
  if (!lastPlayerBid) {
    // Ne završavaj licitaciju - dozvoli mu da licitira
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
    // Igrač je već licitirao - završi licitaciju
    licData.finished = true;
    licData.winnerId = activePlayers[0];
  }
} else if (activePlayers.length === 0) {
  licData.finished = true;
  licData.winnerId = null;
} else {
  const maxPlayers = allPlayers.length;
  // Nastavi licitaciju sa sledećim igračem
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
  
      updateRoundLicitacija(round.id, licData, (updErr) => {
        if (updErr) {
          console.error("Greška pri update-u licitacija:", updErr);
          return;
        }
  
        // Emit
        io.to(`game_${gameId}`).emit("licitacijaUpdated", licData);
  
        if (licData.finished) {
          // Kad licitacija završi, obično otvaraš talon ili prelaziš na fazu škarta
          io.to(`game_${gameId}`).emit("openTalon", { winnerId: licData.winnerId });
          console.log(
            `Licitacija završena. WinnerId=${licData.winnerId || "none"}`
          );
        }
      });
    });
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

  // Primer za "cardPlayed"
  socket.on("cardPlayed", ({ roundId, playerId }) => {
    console.log(`Igrač ${playerId} je odigrao kartu u rundi: ${roundId}`);

    // Primer logike za određivanje sledećeg poteza
    db.query(
      "SELECT player_order FROM rounds WHERE id = ?",
      [roundId],
      (err, results) => {
        if (err || results.length === 0) {
          console.error("Greška pri dohvatanju player_order:", err);
          return;
        }

        const playerOrder = JSON.parse(results[0].player_order);
        const currentIndex = playerOrder.indexOf(playerId);

        // Proverimo da li su svim igračima prazne ruke
        db.query(
          "SELECT hand FROM game_players WHERE round_id = ?",
          [roundId],
          (handErr, players) => {
            if (handErr) {
              console.error("Greška pri dohvatanju ruku igrača:", handErr);
              return;
            }

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

              // Možemo pozvati funkciju za novu rundu
              startNewRound(roundId);
            } else {
              // Ako runda nije gotova, odredi ko je sledeći
              const nextIndex = (currentIndex + 1) % playerOrder.length;
              const nextPlayerId = playerOrder[nextIndex];

              io.to(`game_${roundId}`).emit("nextPlayer", { nextPlayerId });
              console.log(`Sledeći igrač: ${nextPlayerId}`);
            }
          }
        );
      }
    );
  });

  // Funkcija za pokretanje nove runde
  function startNewRound(gameId) {
    db.query(
      "SELECT hand FROM game_players WHERE game_id = ?",
      [gameId],
      (err, results) => {
        if (err) {
          console.error("Greška pri proveri ruku igrača:", err);
          return;
        }

        // Proverimo da li su stvarno sve ruke prazne
        const handsEmpty = results.every((p) => {
          const handArr = JSON.parse(p.hand || "[]");
          return handArr.length === 0;
        });

        if (!handsEmpty) {
          console.warn("Ne možemo započeti novu rundu, igrači još imaju karte.");
          return;
        }

        // Dohvati player_order iz poslednje runde
        db.query(
          "SELECT player_order FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 1",
          [gameId],
          (roundErr, roundRows) => {
            if (roundErr) {
              console.error("Greška pri dohvatanju poslednje runde:", roundErr);
              return;
            }

            const playerOrder = roundRows.length
              ? JSON.parse(roundRows[0].player_order)
              : [];

            // Kreiramo inicijalnu licitaciju
            const licitacija = {
              playerOrder,
              currentPlayerIndex: 0,
              bids: [],
              minBid: 5,
              passedPlayers: [],
              finished: false,
            };

            // Insert nove runde
            db.query(
              "INSERT INTO rounds (game_id, player_order, licitacija) VALUES (?, ?, ?)",
              [gameId, JSON.stringify(playerOrder), JSON.stringify(licitacija)],
              (insertErr, result) => {
                if (insertErr) {
                  console.error("Greška pri kreiranju nove runde:", insertErr);
                  return;
                }

                const newRoundId = result.insertId;
                console.log(`Nova runda kreirana sa ID: ${newRoundId} za gameId=${gameId}`);

                // Resetujemo hand-ove i dodeljujemo novi round_id za igrače
                db.query(
                  "UPDATE game_players SET round_id = ?, hand = '[]' WHERE game_id = ?",
                  [newRoundId, gameId],
                  (updateErr, updateResults) => {
                    if (updateErr) {
                      console.error("Greška pri ažuriranju igrača (round_id):", updateErr);
                      return;
                    }

                    if (updateResults.affectedRows === 0) {
                      console.warn(
                        `Nema ažuriranih igrača za gameId=${gameId}. Da li postoje?`
                      );
                    } else {
                      console.log(
                        `Ažurirano ${updateResults.affectedRows} igrača za gameId=${gameId} sa roundId=${newRoundId}`
                      );
                    }

                    // Delimo nove karte
                    const deck = generateDeck();
                    const playerHands = [
                      deck.slice(0, 10),
                      deck.slice(10, 20),
                      deck.slice(20, 30),
                    ];
                    const talon = deck.slice(30, 32);

                    // Ažuriraj hand za svakog igrača na osnovu playerOrder-a
                    const updates = playerHands.map((hand, index) => {
                      return new Promise((resolve, reject) => {
                        db.query(
                          "UPDATE game_players SET hand = ? WHERE id = ?",
                          [JSON.stringify(hand), playerOrder[index]],
                          (err) => (err ? reject(err) : resolve())
                        );
                      });
                    });

                    Promise.all(updates)
                      .then(() => {
                        console.log("Ruke uspešno ažurirane za sve igrače.");

                        // Ažuriramo talon u rounds
                        db.query(
                          "UPDATE rounds SET talon_cards = ? WHERE id = ?",
                          [JSON.stringify(talon), newRoundId],
                          (talonErr) => {
                            if (talonErr) {
                              console.error("Greška pri ažuriranju talona:", talonErr);
                              return;
                            }

                            console.log(
                              `Talon uspešno ažuriran za rundu ${newRoundId}`
                            );

                            // Emitujemo "newRound" svim klijentima
                            io.to(`game_${gameId}`).emit("newRound", {
                              roundId: newRoundId,
                              playerOrder,
                            });

                            console.log(`Nova runda ${newRoundId} je startovana.`);
                          }
                        );
                      })
                      .catch((err) => {
                        console.error("Greška pri ažuriranju hand-ova igrača:", err);
                      });
                  }
                );
              }
            );
          }
        );
      }
    );
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
