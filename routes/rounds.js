const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper za generisanje 32-karatnog špila
function generateDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['A', 'K', 'Q', 'J', '10', '9', '8', '7'];
  const deck = [];
  for (const suit of suits) {
    for (const value of values) {
      deck.push({ suit, value });
    }
  }
  return deck.sort(() => Math.random() - 0.5);
}

// OVO je bitno: /api/rounds/:gameId/deal
router.post('/:gameId/deal', (req, res) => {
  const { gameId } = req.params;
  if (!gameId) {
    return res.status(400).json({ error: 'Nema gameId u URL-u' });
  }

  // Generišemo špil
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

    // Napravi tri ruke, po 10 karata, + talon
    const playerHands = [
      deck.slice(0, 10),
      deck.slice(10, 20),
      deck.slice(20, 30),
    ];
    const talon = deck.slice(30, 32);

    // Upis u bazu
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
        // Možeš i u `games` tabelu da upišeš talon ako želiš:
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

// Create a new round
router.post('/', (req, res) => {
    const { gameId, privremeniRezultat } = req.body;

    if (!gameId) {
        return res.status(400).json({ error: 'Game ID is required' });
    }

    // ...
});

// Fetch rounds by game ID
router.get('/:gameId', (req, res) => {
    const { gameId } = req.params;

    // ...
});

module.exports = router;
