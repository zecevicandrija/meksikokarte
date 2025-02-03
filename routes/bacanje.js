// routes/bacanje.js

const express = require("express");
const db = require("../db");
// VAŽNO: Pošto smo prešli na "server side" kreiranje nove runde,
// više nam ne treba axios (možeš ga obrisati):
// const axios = require("axios");

module.exports = (io) => {
  const router = express.Router();

  // [1] Pomocna funkcija za pronalaženje najjače karte
  function findHighestCard(cards) {
    const valueOrder = ["7", "8", "9", "10", "J", "Q", "K", "A"];
    return cards.reduce((highest, card) => {
      return valueOrder.indexOf(card.card_value) >
        valueOrder.indexOf(highest.card_value)
        ? card
        : highest;
    });
  }

  // [2] (NOVO) Funkcija za generisanje špila od 32 karte
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
    // Fisher-Yates mešanje
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  // [3] (NOVO) Pomoćna funkcija: kreiraj novu rundu direktno na serveru
  function createNewRoundServerSide(gameId, io, db) {
    return new Promise((resolve, reject) => {
      // 1) Dohvati poslednju rundu (da uzmemo player_order)
      db.query(
        "SELECT player_order FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 1",
        [gameId],
        (err, roundRows) => {
          if (err) {
            return reject(err);
          }
          if (!roundRows || roundRows.length === 0) {
            return reject("Nema prethodne runde – nema player_order!");
          }

          const previousPlayerOrder = JSON.parse(roundRows[0].player_order || "[]");
           // Rotate the player_order array: [1,2,3] becomes [2,3,1]
    const rotatedPlayerOrder = [
      ...previousPlayerOrder.slice(1),
      previousPlayerOrder[0]
    ];

          // Kreiraj inicijalnu licitaciju za novu rundu
          const novaLicitacija = {
            playerOrder: rotatedPlayerOrder,
            currentPlayerIndex: 0,
            bids: Array(rotatedPlayerOrder.length).fill(null),
            minBid: 5,
            passedPlayers: [],
            finished: false,
          };

          // 2) Napravi novu rundu u bazi
          db.query(
            `INSERT INTO rounds (game_id, player_order, licitacija, adut, talon_cards) 
             VALUES (?, ?, ?, NULL, NULL)`,
            [gameId, JSON.stringify(rotatedPlayerOrder), JSON.stringify(novaLicitacija)],
            (insertErr, insertResult) => {
              if (insertErr) {
                return reject(insertErr);
              }
              const newRoundId = insertResult.insertId;

              // 3) Generiši špil i podeli karte
              const deck = generateDeck();
              const playerHands = [
                deck.slice(0, 10),
                deck.slice(10, 20),
                deck.slice(20, 30),
              ];
              const talon = deck.slice(30, 32);

              // 4) Dohvati sve igrače (game_players) i ažuriraj im ruke
              db.query(
                "SELECT id FROM game_players WHERE game_id = ? ORDER BY id ASC",
                [gameId],
                (playersErr, players) => {
                  if (playersErr) {
                    return reject(playersErr);
                  }

                  const updates = players.map((player, idx) => {
                    const handJSON = JSON.stringify(playerHands[idx] || []);
                    return new Promise((res, rej) => {
                      db.query(
                        "UPDATE game_players SET hand = ?, round_id = ? WHERE id = ?",
                        [handJSON, newRoundId, player.id],
                        (updErr) => (updErr ? rej(updErr) : res())
                      );
                    });
                  });

                  Promise.all(updates)
                    .then(() => {
                      // 5) Sačuvaj talon u rounds
                      db.query(
                        "UPDATE rounds SET talon_cards = ? WHERE id = ?",
                        [JSON.stringify(talon), newRoundId],
                        (talonErr) => {
                          if (talonErr) {
                            return reject(talonErr);
                          }

                          // Emit događaje
                          io.to(`game_${gameId}`).emit("licitacijaUpdated", novaLicitacija);
                          io.to(`game_${gameId}`).emit("newRound", {
                            roundId: newRoundId,
                            playerOrder: rotatedPlayerOrder,
                          });

                          // Može i nextTurn event da započne novu licitaciju od prvog igrača
                          io.to(`game_${gameId}`).emit("nextTurn", {
                            nextPlayerId: rotatedPlayerOrder[0],
                          });

                          resolve(newRoundId);
                        }
                      );
                    })
                    .catch(reject);
                }
              );
            }
          );
        }
      );
    });
  }

  // ---------------------------
  // [4] Ruta: Dodavanje novog bacanja
  // ---------------------------
  router.post("/:gameId", (req, res) => {
    const { gameId } = req.params;
    const { playerId, cardValue, cardSuit } = req.body;
    const numericPlayerId = parseInt(playerId, 10);

    // 1. Dohvati game_player ID
    db.query(
      "SELECT id FROM game_players WHERE game_id = ? AND user_id = ?",
      [gameId, numericPlayerId],
      (playerErr, playerResults) => {
        if (playerErr || !playerResults.length) {
          console.error("Greška pri dohvatanju igrača:", playerErr);
          return res.status(500).json({ error: "Igrač nije pronađen" });
        }

        const gamePlayerId = playerResults[0].id;

        // 2. Dohvati aktivnu rundu
        db.query(
          "SELECT id, player_order FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 1",
          [gameId],
          (roundErr, roundResults) => {
            if (roundErr || !roundResults.length) {
              console.error("Greška pri dohvatanju runde:", roundErr);
              return res.status(500).send("Runda nije pronađena");
            }

            const roundId = roundResults[0].id;
            const playerOrder = JSON.parse(roundResults[0].player_order);

            // 3. Odredi redosled igranja
            db.query(
              "SELECT MAX(play_order) AS maxOrder FROM card_plays WHERE round_id = ?",
              [roundId],
              (orderErr, orderResults) => {
                if (orderErr) {
                  console.error("Greška pri dohvatanju play_order:", orderErr);
                  return res.status(500).send("Greška pri određivanju reda");
                }

                const newOrder = (orderResults[0]?.maxOrder || 0) + 1;

                // 4. Dodaj potez u bazu
                db.query(
                  "INSERT INTO card_plays (game_id, round_id, player_id, card_value, card_suit, play_order) VALUES (?, ?, ?, ?, ?, ?)",
                  [gameId, roundId, gamePlayerId, cardValue, cardSuit, newOrder],
                  (insertErr) => {
                    if (insertErr) {
                      console.error("Greška pri dodavanju poteza:", insertErr);
                      return res.status(500).send("Greška pri dodavanju poteza");
                    }

                    // 5. Ažuriraj ruku igrača
                    db.query(
                      "SELECT hand FROM game_players WHERE id = ?",
                      [gamePlayerId],
                      (handErr, handResults) => {
                        if (handErr || !handResults.length) {
                          console.error("Greška pri dohvatanju ruke:", handErr);
                          return res.status(500).send("Greška pri ažuriranju ruke");
                        }

                        const currentHand = JSON.parse(handResults[0].hand || "[]");
                        const updatedHand = currentHand.filter(
                          (c) => !(c.value === cardValue && c.suit === cardSuit)
                        );

                        // 6. Sačuvaj novu ruku
                        db.query(
                          "UPDATE game_players SET hand = ? WHERE id = ?",
                          [JSON.stringify(updatedHand), gamePlayerId],
                          (updateErr) => {
                            if (updateErr) {
                              console.error("Greška pri ažuriranju ruke:", updateErr);
                              return res
                                .status(500)
                                .send("Greška pri ažuriranju ruke");
                            }

                            // 7. Odredi sledećeg igrača
                            const currentIndex = playerOrder.indexOf(numericPlayerId);
                            if (currentIndex === -1) {
                              return res
                                .status(500)
                                .send("Igrač nije u redosledu");
                            }

                            const nextIndex = (currentIndex + 1) % playerOrder.length;
                            const nextPlayerId = playerOrder[nextIndex];

                            // 8. Emituj događaje
                            io.to(`game_${gameId}`).emit("cardPlayed", {
                              playerId: numericPlayerId,
                              cardValue,
                              cardSuit,
                              image: `/Slike/${cardValue}_${
                                cardSuit === "♠"
                                  ? "spades"
                                  : cardSuit === "♥"
                                  ? "hearts"
                                  : cardSuit === "♦"
                                  ? "diamonds"
                                  : "clubs"
                              }.png`,
                              nextPlayerId: Number(nextPlayerId),
                            });

                            io.to(`game_${gameId}`).emit("handUpdated", {
                              userId: numericPlayerId,
                              newHand: updatedHand,
                            });

                            io.to(`game_${gameId}`).emit("updateTable", {
                              roundId,
                              gameId,
                            });

                            console.log(
                              `Karta bačena. Sledeći igrač: ${nextPlayerId}`
                            );
                            res.status(200).send("Karta uspešno bačena");
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  });

  // [5] Ruta: Dohvati sva bacanja za rundu
  router.get("/:roundId", (req, res) => {
    const { roundId } = req.params;

    db.query(
      "SELECT * FROM card_plays WHERE round_id = ? ORDER BY play_order ASC",
      [roundId],
      (err, results) => {
        if (err) {
          console.error("Greška pri dohvatanju bacanja:", err);
          return res.status(500).send("Greška pri dohvatanju bacanja.");
        }
        res.status(200).json(results);
      }
    );
  });

  // [6] Logika za ko nosi karte
  router.post("/:gameId/resolveTurn", (req, res) => {
    const { gameId } = req.params;
    console.log("Početak resolveTurn za igru:", gameId);
  
    // 1) Dohvati ID i adut iz rounds
    db.query(
      "SELECT id, adut FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 1",
      [gameId],
      (adutErr, adutResults) => {
        if (adutErr || adutResults.length === 0) {
          console.error("Greška pri dohvatanju aduta:", adutErr);
          return res.status(500).json({ error: "Greška pri dohvatanju aduta." });
        }
  
        const { id: roundId, adut: trumpSuit } = adutResults[0];
  
        // 2) Dohvati sve karte koje su odigrane, a nisu "resolved"
        db.query(
          `
            SELECT card_value, card_suit, player_id, resolved, play_order
            FROM card_plays
            WHERE game_id = ? AND resolved = 0
            ORDER BY play_order ASC
          `,
          [gameId],
          (err, playedCards) => {
            if (err) {
              console.error("Greška pri dohvatanju odigranih karata:", err);
              return res.status(500).json({ error: "Database error" });
            }
  
            // Ako nema 3 nove karte, još nije kompletiran potez
            if (playedCards.length !== 3) {
              console.log(
                `Nema dovoljno (3) odigranih karata. Trenutno: ${playedCards.length}`
              );
              return res.status(400).json({ error: "Not enough cards played" });
            }
  
            // 3) Odredi pobedničku kartu
            const firstSuit = playedCards[0].card_suit;
            const trumpCards = playedCards.filter(
              (card) => card.card_suit === trumpSuit
            );
  
            let winnerCard;
            if (trumpCards.length > 0) {
              winnerCard = findHighestCard(trumpCards);
            } else {
              const sameSuitCards = playedCards.filter(
                (card) => card.card_suit === firstSuit
              );
              winnerCard = findHighestCard(sameSuitCards);
            }
  
            const winnerPlayerId = winnerCard.player_id;
            console.log("Pobednička karta:", winnerCard);
  
            // 4) Dohvati user_id za pobedničkog player_id
            db.query(
              `SELECT user_id FROM game_players WHERE id = ?`,
              [winnerPlayerId],
              (userErr, userResults) => {
                if (userErr || userResults.length === 0) {
                  console.error("Greška pri dohvatanju user_id pobednika:", userErr);
                  return res.status(500).json({ error: "Database error" });
                }
  
                const winnerUserId = userResults[0].user_id;
  
                // 5a) Upiši winner_player_id za ove karte
                db.query(
                  `
                    UPDATE card_plays
                    SET winner_player_id = ?
                    WHERE game_id = ? AND resolved = 0
                  `,
                  [winnerPlayerId, gameId],
                  (updWinnerErr) => {
                    if (updWinnerErr) {
                      console.error("Greška pri upisu winner_player_id:", updWinnerErr);
                      return res
                        .status(500)
                        .json({ error: "Greška pri upisu winner_player_id." });
                    }
  
                    // 5b) +1 score
                    db.query(
                      `UPDATE game_players 
                       SET score = score + 1
                       WHERE game_id = ? AND user_id = ?`,
                      [gameId, winnerUserId],
                      (scoreErr) => {
                        if (scoreErr) {
                          console.error("Greška pri ažuriranju skora:", scoreErr);
                          return res.status(500).json({ error: "Database error" });
                        }
                        console.log(
                          `+1 poen za user_id=${winnerUserId} u gameId=${gameId}`
                        );
  
                        // Emit scoreUpdated
                        io.to(`game_${gameId}`).emit("scoreUpdated", {
                          userId: winnerUserId,
                        });
  
                        // 6) Markiraj karte kao resolved
                        db.query(
                          `UPDATE card_plays 
                           SET resolved = 1 
                           WHERE game_id = ? AND resolved = 0`,
                          [gameId],
                          (updateErr) => {
                            if (updateErr) {
                              console.error("Greška pri ažuriranju resolved:", updateErr);
                              return res.status(500).json({ error: "Database error" });
                            }
  
                            // Emit clearTable event
                            io.to(`game_${gameId}`).emit("clearTable", {
                              winnerId: winnerUserId,
                            });
  
                            // 7) Proveri da li svi igrači nemaju karte
                            db.query(
                              "SELECT hand FROM game_players WHERE game_id = ?",
                              [gameId],
                              (err2, players) => {
                                if (err2) {
                                  console.error("Greška pri dohvatanju ruku igrača:", err2);
                                  return res.status(500).json({ error: "Database error" });
                                }
  
                                const allEmpty = players.every((p) => {
                                  const arr = JSON.parse(p.hand || "[]");
                                  return arr.length === 0;
                                });
  
                                if (allEmpty) {
                                  // Svi igrači su potrošili karte – kraj runde.
                                  // Prvo proveravamo licitaciju
                                  db.query(
                                    "SELECT licitacija FROM rounds WHERE id = ?",
                                    [roundId],
                                    (errLic, licRows) => {
                                      if (errLic) {
                                        console.error("Ne mogu da dohvatim licitaciju:", errLic);
                                      }
                                      let licData = {};
                                      if (licRows && licRows.length) {
                                        try {
                                          licData = JSON.parse(licRows[0].licitacija || "{}");
                                        } catch (e) {
                                          console.error("Greška pri parsiranju licitacije:", e);
                                        }
                                      }
  
                                      // Ako je licitacija završena i imamo pobednika, obrađujemo to
                                      if (licData.finished && licData.winnerId) {
                                        const licWinnerUserId = licData.winnerId;
                                        // Pronađi indeks tog igrača u playerOrder
                                        const idx = licData.playerOrder.indexOf(licWinnerUserId);
                                        const finalBid = licData.bids && licData.bids[idx] ? licData.bids[idx] : 0;
  
                                        // Prebroj koliko nošenja je osvojio taj igrač u ovoj rundi
                                        db.query(
                                          `SELECT COUNT(DISTINCT FLOOR((play_order - 1) / 3)) AS totalWon
                                           FROM card_plays
                                           WHERE round_id = ?
                                             AND winner_player_id IS NOT NULL
                                             AND winner_player_id = (
                                               SELECT id FROM game_players 
                                               WHERE game_id = ? AND user_id = ?
                                             )`,
                                          [roundId, gameId, licWinnerUserId],
                                          (errWon, wonRows) => {
                                            if (errWon) {
                                              console.error("Greška pri brojanju nošenja:", errWon);
                                              // Ako se desi greška, nastavljamo bez dodatnih penalizacija
                                            }
                                            const totalWon = (wonRows && wonRows[0] && wonRows[0].totalWon) || 0;
                                            console.log(
                                              `Igrač ${licWinnerUserId} licitirao ${finalBid}, osvojio ${totalWon} nošenja.`
                                            );
  
                                            // Obrada slučaja “Meksiko”
                                            if (finalBid === 11) { 
                                              if (totalWon === 10) {
                                                // Igrač je osvojio – dodaj +100
                                                db.query(
                                                  `UPDATE game_players 
                                                   SET score = score + 100 
                                                   WHERE game_id = ? AND user_id = ?`,
                                                  [gameId, licWinnerUserId],
                                                  (updateErr) => {
                                                    if (updateErr) {
                                                      console.error("Error adding 100 points for Mexico:", updateErr);
                                                      // Ako dođe do greške, prekidamo dalji tok
                                                      if (!res.headersSent) {
                                                        return res.status(500).json({ error: "Database error" });
                                                      }
                                                      return;
                                                    }
  
                                                    // Proveri skor da li je neko dostigao 51
                                                    db.query(
                                                      "SELECT user_id, score FROM game_players WHERE game_id = ?",
                                                      [gameId],
                                                      (scoreErr, scoreResults) => {
                                                        if (scoreErr) {
                                                          console.error("Error fetching updated scores after Mexico win:", scoreErr);
                                                          if (!res.headersSent) {
                                                            return res.status(500).json({ error: "Database error" });
                                                          }
                                                          return;
                                                        }
  
                                                        const updatedScores = scoreResults.map(r => ({
                                                          userId: r.user_id,
                                                          score: r.score
                                                        }));
  
                                                        const gameWinner = updatedScores.find(p => p.score >= 51);
  
                                                        // Emit gameOver
                                                        io.to(`game_${gameId}`).emit("gameOver", {
                                                          winnerId: licWinnerUserId,
                                                          scores: updatedScores
                                                        });
  
                                                        // Označi rundu kao završenu
                                                        db.query(
                                                          "UPDATE rounds SET licitacija = JSON_SET(COALESCE(licitacija, '{}'), '$.finished', CAST(true AS JSON)) WHERE id = ?",
                                                          [roundId],
                                                          (updateErr2) => {
                                                            if (updateErr2) {
                                                              console.error("Error marking round as finished:", updateErr2);
                                                            }
                                                            if (!res.headersSent) {
                                                              // Vrati odgovor i prekini dalje izvršavanje
                                                              return res.status(200).json({ message: "Meksiko pobeda! Igra je gotova" });
                                                            }
                                                          }
                                                        );
                                                      }
                                                    );
                                                  }
                                                );
                                                return; // Prekidamo dalji tok nakon Meksiko pobede
                                              } else {
                                                // Penalizacija – igrač nije osvojio dovoljan broj nošenja
                                                const penalty = 40;
                                                db.query(
                                                  `UPDATE game_players 
                                                   SET score = score - ? 
                                                   WHERE game_id = ? AND user_id = ?`,
                                                  [penalty, gameId, licWinnerUserId],
                                                  (updErr) => {
                                                    if (updErr) {
                                                      console.error("Greška pri upisu penala:", updErr);
                                                    }
                                                    io.to(`game_${gameId}`).emit("scoreUpdated", {
                                                      userId: licWinnerUserId,
                                                      penalty: penalty
                                                    });
  
                                                    if (totalWon > 0) {
                                                      db.query(
                                                        `UPDATE game_players
                                                         SET score = score - ?
                                                         WHERE game_id = ? AND user_id = ?`,
                                                        [totalWon, gameId, licWinnerUserId],
                                                        (updErr2) => {
                                                          if (updErr2) console.error("Greška pri oduzimanju osvojenih bodova:", updErr2);
                                                        }
                                                      );
                                                    }
                                                  }
                                                );
                                              }
                                            } else if (totalWon < finalBid) {
                                              // Standardni penal za nedovoljno nošenja
                                              const penalty = 2 * finalBid;
                                              db.query(
                                                `UPDATE game_players
                                                 SET score = score - ?
                                                 WHERE game_id = ? AND user_id = ?`,
                                                [penalty, gameId, licWinnerUserId],
                                                (updErr) => {
                                                  if (updErr) {
                                                    console.error("Greška pri upisu penala:", updErr);
                                                    if (!res.headersSent) {
                                                      return res.status(500).json({ error: "Database error" });
                                                    }
                                                    return;
                                                  }
                                                  console.log(`Penal ${penalty} i -${totalWon} za igrača ${licWinnerUserId}`);
                                                  io.to(`game_${gameId}`).emit("scoreUpdated", {
                                                    userId: licWinnerUserId
                                                  });
                                                  if (totalWon > 0) {
                                                    db.query(
                                                      `UPDATE game_players
                                                       SET score = score - ?
                                                       WHERE game_id = ? AND user_id = ?`,
                                                      [totalWon, gameId, licWinnerUserId],
                                                      (updErr2) => {
                                                        if (updErr2) console.error("Greška pri oduzimanju osvojenih bodova:", updErr2);
                                                      }
                                                    );
                                                  }
                                                }
                                              );
                                            }
                                            // Nakon obrade licitacije kada su svi bez karata, proveravamo da li je igra završena.
                                            db.query(
                                              "SELECT user_id, score FROM game_players WHERE game_id = ?",
                                              [gameId],
                                              (scoreErr, scoreResults) => {
                                                if (scoreErr) {
                                                  console.error("Greška pri dohvatanju skorova:", scoreErr);
                                                  if (!res.headersSent) {
                                                    return res.status(500).json({ error: "Database error" });
                                                  }
                                                  return;
                                                }
  
                                                const scores = scoreResults.map((r) => ({
                                                  userId: r.user_id,
                                                  score: r.score,
                                                }));
                                                const gameWinner = scores.find(
                                                  (p) => p.score >= 51
                                                );
  
                                                if (gameWinner) {
                                                  io.to(`game_${gameId}`).emit("gameOver", {
                                                    winnerId: gameWinner.userId,
                                                    scores,
                                                  });
                                                  db.query(
                                                    "UPDATE rounds SET licitacija = JSON_SET(COALESCE(licitacija, '{}'), '$.finished', CAST(true AS JSON)) WHERE id = ?",
                                                    [roundId],
                                                    (updateErr2) => {
                                                      if (updateErr2) {
                                                        console.error("Greška pri označavanju runde kao završene:", updateErr2);
                                                      }
                                                      if (!res.headersSent) {
                                                        return res.status(200).json({ message: "Igra je gotova" });
                                                      }
                                                    }
                                                  );
                                                } else {
                                                  // Ako nema pobednika, ali su svi bez karata, završavamo rundu.
                                                  io.to(`game_${gameId}`).emit("roundEnded", { gameId });
                                                  db.query(
                                                    "UPDATE rounds SET licitacija = JSON_SET(COALESCE(licitacija, '{}'), '$.finished', CAST(true AS JSON)) WHERE id = ?",
                                                    [roundId],
                                                    (updateErr2) => {
                                                      if (updateErr2) {
                                                        console.error("Greška pri označavanju runde kao završene:", updateErr2);
                                                        if (!res.headersSent) {
                                                          return res.status(500).json({ error: "Database error" });
                                                        }
                                                        return;
                                                      }
                                                      console.log("Svi su bez karata, krećemo novu rundu.");
                                                      createNewRoundServerSide(gameId, io, db)
                                                        .then(() => {
                                                          if (!res.headersSent) {
                                                            return res.status(200).json({ message: "Nova runda je startovana server-side." });
                                                          }
                                                        })
                                                        .catch((errCreate) => {
                                                          console.error("Greška pri kreiranju nove runde server-side:", errCreate);
                                                          if (!res.headersSent) {
                                                            return res.status(500).json({ error: "Greška u kreiranju runde." });
                                                          }
                                                        });
                                                    }
                                                  );
                                                }
                                              }
                                            );
                                          }
                                        );
                                      } else {
                                        // Ako licitacija nije završena, nastavljamo na sledeći potez.
                                        io.to(`game_${gameId}`).emit("nextTurn", {
                                          nextPlayerId: winnerUserId,
                                        });
                                        if (!res.headersSent) {
                                          return res.status(200).send("Turn resolved successfully.");
                                        }
                                      }
                                    }
                                  );
                                } else {
                                  // Ako nisu svi bez karata, prelazimo na sledeći potez.
                                  io.to(`game_${gameId}`).emit("nextTurn", {
                                    nextPlayerId: winnerUserId,
                                  });
                                  if (!res.headersSent) {
                                    return res.status(200).send("Turn resolved successfully.");
                                  }
                                }
                              }
                            );
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  });
  

  // [7] "Trenutno na stolu" -> GET
  router.get("/:gameId/currentTable", (req, res) => {
    const { gameId } = req.params;

    db.query(
      "SELECT * FROM card_plays WHERE game_id = ? AND resolved = 0 ORDER BY play_order ASC",
      [gameId],
      (err, results) => {
        if (err) {
          console.error("Greška pri dohvatanju trenutnog stola:", err);
          return res.status(500).send("Greška u bazi podataka.");
        }
        res.status(200).json({ playedCards: results });
      }
    );
  });
  

  return router;
};
