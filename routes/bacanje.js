// routes/bacanje.js
const express = require("express");
const db = require("../db");

module.exports = (io) => {
  const router = express.Router();
  // Pomoćna funkcija za pronalaženje najjače karte
function findHighestCard(cards) {
  const valueOrder = ["7", "8", "9", "10", "J", "Q", "K", "A"];
  return cards.reduce((highest, card) => {
    return valueOrder.indexOf(card.card_value) >
      valueOrder.indexOf(highest.card_value)
      ? card
      : highest;
  });
}

  // Dodavanje novog bacanja
  router.post("/:gameId", (req, res) => {
    const { gameId } = req.params;
    const { playerId, cardValue, cardSuit } = req.body;
    
    // 1) Odmah ovde parsirate playerId u broj
    const numericPlayerId = parseInt(playerId, 10);
    //console.log(`Primljen zahtev za bacanje karte:`, { gameId, playerId, numericPlayerId, cardValue, cardSuit });
  
    // Dohvatite ID iz tabele game_players
    db.query(
      "SELECT id FROM game_players WHERE game_id = ? AND user_id = ?",
      [gameId, numericPlayerId],
      (playerErr, playerResults) => {
        if (playerErr || playerResults.length === 0) {
          console.error("Greška pri dohvatanju igrača:", playerErr || "Nije pronađen igrač.");
          return res.status(500).json({ error: "Igrač nije pronađen u igri." });
        }
  
        const gamePlayerId = playerResults[0].id; // ID za unos u card_plays
  
        db.query(
          "SELECT id, player_order FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 1",
          [gameId],
          (roundErr, roundResults) => {
            if (roundErr || roundResults.length === 0) {
              console.error("Greška pri dohvatanju runde:", roundErr || "Nema rezultata");
              return res.status(500).send("Runda nije pronađena.");
            }
  
            console.log("Dohvaćena runda:", roundResults);
  
            const roundId = roundResults[0].id;
            const playerOrder = JSON.parse(roundResults[0].player_order);
            console.log("playerOrder =", playerOrder, "playerId =", playerId, "typeof playerId =", typeof playerId);

            db.query(
              "SELECT MAX(play_order) AS maxOrder FROM card_plays WHERE round_id = ?",
              [roundId],
              (orderErr, orderResults) => {
                if (orderErr) {
                  console.error("Greška pri dohvatanju play_order:", orderErr);
                  return res.status(500).send("Greška pri određivanju reda igranja.");
                }
  
                const newOrder = (orderResults[0]?.maxOrder || 0) + 1;
  
                db.query(
                  "INSERT INTO card_plays (game_id, round_id, player_id, card_value, card_suit, play_order) VALUES (?, ?, ?, ?, ?, ?)",
                  [gameId, roundId, gamePlayerId, cardValue, cardSuit, newOrder],
                  (insertErr) => {
                    if (insertErr) {
                      console.error("Greška pri dodavanju poteza:", insertErr);
                      return res.status(500).send("Greška pri dodavanju poteza.");
                    }
  
                    const currentIndex = playerOrder.indexOf(numericPlayerId);
                    if (currentIndex === -1) {
                      console.error(`Igrač ${playerId} nije pronađen u redosledu.`);
                      return res.status(500).send("Greška pri prebacivanju igrača.");
                    }
  
                    const nextIndex = (currentIndex + 1) % playerOrder.length;
                    const nextPlayerId = playerOrder[nextIndex];
  
                    // Emituj događaj svim igračima u sobi
                    io.to(`game_${gameId}`).emit("cardPlayed", {
                      playerId: numericPlayerId,
                      cardValue,
                      cardSuit,
                      image: `/Slike/${cardValue}_${
                        cardSuit === "♠" ? "spades"
                        : cardSuit === "♥" ? "hearts"
                        : cardSuit === "♦" ? "diamonds"
                        : "clubs"
                      }.png`,
                      nextPlayerId: Number(nextPlayerId),
                    });

                    io.to(`game_${gameId}`).emit("updateTable", { roundId, gameId });
  
                    console.log(`Potez uspešno dodat. Sledeći igrač: ${nextPlayerId}`);
                    res.status(200).send("Karta uspešno bačena.");
                  }
                );
              }
            );
          }
        );
      }
    );
  });
  
  
  

  // Dohvati sva bacanja za rundu
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

  // Logika za ko nosi karte
  router.post("/:gameId/resolveTurn", (req, res) => {
    const { gameId } = req.params;
    console.log("Početak resolveTurn za igru:", gameId);
  
    // 1) Dohvati adut (ako ga ima) iz rounds
    db.query(
      "SELECT adut FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 1",
      [gameId],
      (adutErr, adutResults) => {
        if (adutErr || adutResults.length === 0) {
          console.error("Greška pri dohvatanju aduta:", adutErr);
          return res.status(500).json({ error: "Greška pri dohvatanju aduta." });
        }
  
        const trumpSuit = adutResults[0].adut; // npr. "♣" ili null ako nije postavljen
  
        // 2) Dohvati sve karte koje su odigrane, a nisu "resolved"
        db.query(
          `
            SELECT card_value, card_suit, player_id, resolved
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
              console.log(`Nema dovoljno (3) odigranih karata. Trenutno: ${playedCards.length}`);
              return res.status(400).json({ error: "Not enough cards played" });
            }
  
            // 3) Odredi pobedničku kartu
            const firstSuit = playedCards[0].card_suit;
            // Filtriramo adute
            const trumpCards = playedCards.filter(
              (card) => card.card_suit === trumpSuit
            );
  
            let winnerCard;
            if (trumpCards.length > 0) {
              // Ako ima aduta, najjači adut
              winnerCard = findHighestCard(trumpCards);
            } else {
              // Ako nema aduta, najjača karta prvog znaka
              const sameSuitCards = playedCards.filter(
                (card) => card.card_suit === firstSuit
              );
              winnerCard = findHighestCard(sameSuitCards);
            }
  
            const winnerPlayerId = winnerCard.player_id;
            console.log("Pobednička karta:", winnerCard);
  
            // 4) Dohvati user_id za pobedničkog player_id iz game_players
            db.query(
              `SELECT user_id FROM game_players WHERE id = ?`,
              [winnerPlayerId],
              (userErr, userResults) => {
                if (userErr || userResults.length === 0) {
                  console.error("Greška pri dohvatanju user_id pobednika:", userErr);
                  return res.status(500).json({ error: "Database error" });
                }
  
                const winnerUserId = userResults[0].user_id;
  
                // 5) Povećaj score za tog usera
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
                    console.log(`+1 poen za user_id=${winnerUserId} u gameId=${gameId}`);
  
                    // Obavesti klijente o ažuriranom skoru
                    io.to(`game_${gameId}`).emit("scoreUpdated", {
                      userId: winnerUserId,
                    });
  
                    // 6) Sada markiraj sve te 3 karte kao resolved
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
  
                        // Emit "clearTable" da klijenti uklone karte sa stola
                        io.to(`game_${gameId}`).emit("clearTable", {
                          winnerId: winnerUserId,
                        });
  
                        // 7) Proveri da li su *svi* igrači ostali bez karata
                        db.query(
                          "SELECT hand FROM game_players WHERE game_id = ?",
                          [gameId],
                          (err2, players) => {
                            if (err2) {
                              console.error("Greška pri dohvatanju ruku igrača:", err2);
                              return res
                                .status(500)
                                .json({ error: "Database error" });
                            }
  
                            const allEmpty = players.every((p) => {
                              const arr = JSON.parse(p.hand || "[]");
                              return arr.length === 0;
                            });
  
                            if (allEmpty) {
                              // Runda je gotova!
                              io.to(`game_${gameId}`).emit("roundEnded", { gameId });
                              console.log("Svi igrači su na 0 karata. Runda ended.");
                              return res
                                .status(200)
                                .send("Round ended. All hands empty.");
                            } else {
                              // Ako *nije* gotovo, pobednik povlači prvi sledeći potez
                              io.to(`game_${gameId}`).emit("nextTurn", {
                                nextPlayerId: winnerUserId,
                              });
                              console.log("Sledeći igrač na potezu:", winnerUserId);
  
                              return res
                                .status(200)
                                .send("Turn resolved successfully.");
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
  });
  
  
  
  
  
  
  
  
  
  
  
  //trenutno na stolu
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
