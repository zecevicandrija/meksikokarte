// routes/bacanje.js
const express = require("express");
const db = require("../db");

module.exports = (io) => {
  const router = express.Router();

  // Dodavanje novog bacanja
  // Dodavanje novog bacanja
router.post("/:gameId", (req, res) => {
    const { gameId } = req.params;
    const { playerId, cardValue, cardSuit } = req.body;
  
    console.log(`Primljen zahtev za bacanje karte:`, { gameId, playerId, cardValue, cardSuit });
  
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
              [gameId, roundId, playerId, cardValue, cardSuit, newOrder],
              (insertErr) => {
                if (insertErr) {
                  console.error("Greška pri dodavanju poteza:", insertErr);
                  return res.status(500).send("Greška pri dodavanju poteza.");
                }
  
                const currentIndex = playerOrder.indexOf(playerId);
                if (currentIndex === -1) {
                  console.error(`Igrač ${playerId} nije pronađen u redosledu.`);
                  return res.status(500).send("Greška pri prebacivanju igrača.");
                }
  
                const nextIndex = (currentIndex + 1) % playerOrder.length;
                const nextPlayerId = playerOrder[nextIndex];
  
                // Emituj događaj svim igračima u sobi
                io.to(`game_${gameId}`).emit("cardPlayed", {
                  playerId,
                  cardValue,
                  cardSuit,
                  image: `/Slike/${cardValue}_${
                    cardSuit === "♠" ? "spades"
                    : cardSuit === "♥" ? "hearts"
                    : cardSuit === "♦" ? "diamonds"
                    : "clubs"
                  }.png`,
                  nextPlayerId,
                });
  
                console.log(`Potez uspešno dodat. Sledeći igrač: ${nextPlayerId}`);
                res.status(200).send("Karta uspešno bačena.");
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

  return router;
};
