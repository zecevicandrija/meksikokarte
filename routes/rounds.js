// routes/rounds.js
module.exports = function(io) {
  const express = require('express');
  const router = express.Router();
  const db = require('../db');

  //  /api/rounds/:gameId/start-round
  router.post('/:gameId/start-round', (req, res) => {
    const { gameId } = req.params;

    // 1) Dohvatamo user_id svih igrača da formiramo playerOrder
    db.query(
      'SELECT user_id FROM game_players WHERE game_id=? ORDER BY id ASC',
      [gameId],
      (err, rows) => {
        if (err) {
          console.error("Greška pri SELECT:", err);
          return res.status(500).json({ error: "DB error" });
        }
        if (rows.length < 3) {
          return res.status(400).json({ error: "Nema 3 igrača" });
        }

        const playerOrder = rows.map(r => r.user_id);

        // 2) Formiramo početni objekat licitacije
        const licitacijaData = {
          playerOrder,
          currentPlayerIndex: 0,
          bids: [null, null, null],
          minBid: 5,
          passedPlayers: []
        };

        // 3) Upis u rounds
        db.query(
          'INSERT INTO rounds (game_id, licitacija) VALUES (?, ?)',
          [gameId, JSON.stringify(licitacijaData)],
          (insErr, result) => {
            if (insErr) {
              console.error("Greška pri insert runde:", insErr);
              return res.status(500).json({ error: "DB error" });
            }

            const roundId = result.insertId;
            console.log(`Nova runda #${roundId} za gameId=${gameId}`);

            // 4) Emitujemo svima da je kreirana licitacija
            io.to(`game_${gameId}`).emit('licitacijaUpdated', licitacijaData);

            return res.status(201).json({
              roundId,
              licitacija: licitacijaData
            });
          }
        );
      }
    );
  });

  // [2] /api/rounds/:gameId/deal
// Generiše špil i podeli karte igračima u bazi
router.post('/:gameId/deal', (req, res) => {
  const { gameId } = req.params;
  if (!gameId) {
    return res.status(400).json({ error: 'Nema gameId u URL-u' });
  }

  const deck = generateDeck();

  // Dohvatamo igrače
  db.query('SELECT id, user_id FROM game_players WHERE game_id = ?', [gameId], (err, players) => {
    if (err) {
      console.error('Greška prilikom dohvatanja igrača:', err);
      return res.status(500).json({ error: 'Greška u bazi' });
    }

    if (players.length < 3) {
      return res.status(400).json({ error: 'Nema dovoljno igrača (3) u igri.' });
    }

    // 3 ruke po 10 karata + 2 talon
    const playerHands = [
      deck.slice(0, 10),
      deck.slice(10, 20),
      deck.slice(20, 30),
    ];
    const talon = deck.slice(30, 32);

    // Upis ruku u bazu
    const promises = players.map((player, i) => {
      const handJson = JSON.stringify(playerHands[i] || []);
      return new Promise((resolve, reject) => {
        db.query(
          'UPDATE game_players SET hand = ? WHERE id = ?',
          [handJson, player.id],
          (upErr) => (upErr ? reject(upErr) : resolve())
        );
      });
    });

    Promise.all(promises)
      .then(() => {
        // Možeš i u `games` da upišeš talon, ako želiš
        db.query(
          'UPDATE games SET talon_cards = ? WHERE id = ?',
          [JSON.stringify(talon), gameId],
          (talonErr) => {
            if (talonErr) {
              console.error('Greška prilikom upisa talona:', talonErr);
              return res.status(500).json({ error: 'Greška u bazi' });
            }

            return res.status(200).json({
              message: 'Karte podeljene (nova runda)',
              talon,
            });
          }
        );
      })
      .catch((promiseErr) => {
        console.error('Greška prilikom ažuriranja ruke igrača:', promiseErr);
        res.status(500).json({ error: 'Greška u bazi' });
      });
  });
});

  return router;
};
