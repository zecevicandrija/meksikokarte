const express = require('express');
const router = express.Router();
const db = require('../db');

// Funkcija za generisanje špila od 32 karte (ako ti treba)
const generateDeck = () => {
  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['A', 'K', 'Q', 'J', '10', '9', '8', '7'];
  const deck = [];

  for (const suit of suits) {
    for (const value of values) {
      deck.push({ suit, value });
    }
  }
  
  // Promešaj špil
  return deck.sort(() => Math.random() - 0.5);
};

// [1] Ruta za kreiranje ili pridruživanje igri
router.post('/', (req, res) => {
  const { userId, tableType, betAmount } = req.body;

  if (!userId || !tableType || !betAmount) {
    return res.status(400).json({ error: 'Недостају потребни подаци' });
  }

  const findGameQuery = `
    SELECT g.id AS gameId, COUNT(gp.id) AS playerCount 
    FROM games g
    LEFT JOIN game_players gp ON g.id = gp.game_id
    WHERE g.status = 'waiting'
      AND g.table_type = ?
      AND g.bet_amount = ?
    GROUP BY g.id
    HAVING playerCount < 3
    LIMIT 1;
  `;

  db.query(findGameQuery, [tableType, betAmount], (err, results) => {
    if (err) {
      console.error('Грешка при претрази игара:', err);
      return res.status(500).json({ error: 'Грешка у бази података' });
    }

    // Постоји игра која чека
    if (results.length > 0) {
      const gameId = results[0].gameId;
      const addPlayerQuery = 'INSERT INTO game_players (game_id, user_id, status) VALUES (?, ?, ?)';
      db.query(addPlayerQuery, [gameId, userId, 'joined'], (playerErr) => {
        if (playerErr) {
          console.error('Грешка при додавању играча:', playerErr);
          return res.status(500).json({ error: 'Грешка у бази података' });
        }
        return res.json({ 
          gameId,
          message: `Ушли сте у игру типа ${tableType} са улогом од ${betAmount} токена`
        });
      });
    } 
    // Креирај нову игру
    else {
      const createGameQuery = `
        INSERT INTO games (created_by, status, table_type, bet_amount) 
        VALUES (?, 'waiting', ?, ?)
      `;
      
      db.query(createGameQuery, [userId, tableType, betAmount], (createErr, createResults) => {
        if (createErr) {
          console.error('Грешка при креирању игре:', createErr);
          return res.status(500).json({ error: 'Грешка у бази података' });
        }

        const gameId = createResults.insertId;
        const addPlayerQuery = 'INSERT INTO game_players (game_id, user_id, status) VALUES (?, ?, ?)';
        db.query(addPlayerQuery, [gameId, userId, 'joined'], (playerErr) => {
          if (playerErr) {
            console.error('Грешка при додавању играча:', playerErr);
            return res.status(500).json({ error: 'Грешка у бази података' });
          }
          res.status(201).json({ 
            gameId,
            message: `Креирана нова игра типа ${tableType} са улогом од ${betAmount} токена`
          });
        });
      });
    }
  });
});


// [3] Ruta za dobijanje informacija o igri
router.get('/:gameId', (req, res) => {
  const { gameId } = req.params;

  const query = 'SELECT * FROM games WHERE id = ?';
  db.query(query, [gameId], (err, results) => {
    if (err) {
      console.error('Greška prilikom dohvatanja igre:', err);
      return res.status(500).json({ error: 'Greška u bazi podataka.' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Igra nije pronađena.' });
    }

    const game = results[0];
    res.status(200).json({
      id: game.id,
      tableType: game.table_type,
      betAmount: game.bet_amount,
      createdBy: game.created_by,
      createdAt: game.created_at,
      status: game.status,
      talonCards: game.talon_cards ? JSON.parse(game.talon_cards) : [],
    });
    //console.log("Talon cards iz baze:", game.talon_cards);

  });
});

// [4] Ruta za dobijanje ruke igrača **po gameId i playerId**
// npr. GET /api/games/:gameId/player/:playerId/hand
router.get('/:gameId/player/:playerId/hand', (req, res) => {
  const { gameId, playerId } = req.params;

  const query = `
    SELECT hand 
    FROM game_players 
    WHERE game_id = ? 
      AND user_id = ? 
    LIMIT 1
  `;
  db.query(query, [gameId, playerId], (err, results) => {
    if (err) {
      console.error('Greška prilikom dohvatanja ruke igrača:', err);
      return res.status(500).json({ error: 'Greška u bazi podataka.' });
    }

    if (results.length === 0) {
      console.warn(`Ruka za igrača ${playerId} u igri ${gameId} nije pronađena.`);
      return res.status(404).json({ error: 'Ruka nije pronađena.' });
    }

    const hand = results[0].hand ? JSON.parse(results[0].hand) : [];
    //console.log(`Ruka za igrača ${playerId} u igri ${gameId}:`, hand);
    res.status(200).json({ hand });
  });
});

module.exports = router;
