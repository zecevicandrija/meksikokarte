// routes/bacanje.js
const express = require("express");
const db = require("../db");

module.exports = (io) => {
  const router = express.Router();

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
  
    // Dohvati trenutni adut (trumpSuit) za ovu rundu
    db.query(
      "SELECT adut FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 1",
      [gameId],
      (adutErr, adutResults) => {
        if (adutErr || adutResults.length === 0) {
          console.error("Greška pri dohvatanju aduta:", adutErr);
          return res.status(500).json({ error: "Greška pri dohvatanju aduta." });
        }
  
        const trumpSuit = adutResults[0].adut; // Postavljamo adut za ovu rundu
  
        // Dohvatamo karte na stolu
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
  
            // Provera broja kartica sa resolved = 0
            if (playedCards.length !== 3) {
              console.log(
                `Još nisu sve 3 karte odigrane. Trenutno broj kartica: ${playedCards.length}`
              );
              return res.status(400).json({ error: "Not enough cards played" });
            }
  
            const firstSuit = playedCards[0].card_suit;
            const cardsOfSameSuit = playedCards.filter(
              (card) => card.card_suit === firstSuit
            );
  
            // Filtriramo adute
            const trumpCards = playedCards.filter(
              (card) => card.card_suit === trumpSuit
            );
  
            // Pobednička karta
            let winnerCard;
  
            if (trumpCards.length > 0) {
              // Ako ima aduta, pobednik je karta sa najvećim adutom
              winnerCard = trumpCards.reduce((highest, card) => {
                const valueOrder = ["7", "8", "9", "10", "J", "Q", "K", "A"];
                return valueOrder.indexOf(card.card_value) >
                  valueOrder.indexOf(highest.card_value)
                  ? card
                  : highest;
              });
            } else {
              // Ako nema aduta, pobednik je karta sa najvećom vrednošću u znaku
              winnerCard = cardsOfSameSuit.reduce((highest, card) => {
                const valueOrder = ["7", "8", "9", "10", "J", "Q", "K", "A"];
                return valueOrder.indexOf(card.card_value) >
                  valueOrder.indexOf(highest.card_value)
                  ? card
                  : highest;
              });
            }
  
            const winnerPlayerId = winnerCard.player_id;
            console.log("Pobednička karta:", winnerCard);
  
            // Ažuriraj sve karte na stolu da budu resolved
            db.query(
              `UPDATE card_plays SET resolved = 1 WHERE game_id = ? AND resolved = 0`,
              [gameId],
              (updateErr) => {
                if (updateErr) {
                  console.error(
                    "Greška pri ažuriranju resolved karata:",
                    updateErr
                  );
                  return res.status(500).json({ error: "Database error" });
                }
  
                // Dohvati user_id za pobedničkog igrača
                db.query(
                  `SELECT user_id FROM game_players WHERE id = ?`,
                  [winnerPlayerId],
                  (userErr, userResults) => {
                    if (userErr || userResults.length === 0) {
                      console.error(
                        "Greška pri dohvatanju user_id za pobednika:",
                        userErr
                      );
                      return;
                    }
  
                    const winnerUserId = userResults[0].user_id;
  
                    // Emituj događaje svim klijentima
                    io.to(`game_${gameId}`).emit("clearTable", {
                      winnerId: winnerUserId,
                    });
                    console.log("Emitovan clearTable za igru:", gameId);
  
                    io.to(`game_${gameId}`).emit("nextTurn", {
                      nextPlayerId: winnerUserId,
                    });
                    console.log("Sledeći igrač na potezu:", winnerUserId);
  
                    res.status(200).send("Turn resolved successfully.");
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
