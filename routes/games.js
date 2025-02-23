const express = require('express');
const router = express.Router();
const { promisePool } = require('../db'); // Uvozimo promisePool iz db.js

// Funkcija za generisanje špila od 32 karte
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
router.post('/', async (req, res) => {
  const { userId, tableType, betAmount } = req.body;

  if (!userId || !tableType || !betAmount) {
    return res.status(400).json({ error: 'Недостају потребни подаци' });
  }

  try {
    // Pronađi igru koja čeka na igrače
    const [results] = await promisePool.query(
      `SELECT g.id AS gameId, COUNT(gp.id) AS playerCount 
       FROM games g
       LEFT JOIN game_players gp ON g.id = gp.game_id
       WHERE g.status = 'waiting'
         AND g.table_type = ?
         AND g.bet_amount = ?
       GROUP BY g.id
       HAVING playerCount < 3
       LIMIT 1`,
      [tableType, betAmount]
    );

    // Ako postoji igra koja čeka, pridruži se
    if (results.length > 0) {
      const gameId = results[0].gameId;
      await promisePool.query(
        'INSERT INTO game_players (game_id, user_id, status) VALUES (?, ?, ?)',
        [gameId, userId, 'joined']
      );

      return res.json({
        gameId,
        message: `Ушли сте у игру типа ${tableType} са улогом од ${betAmount} токена`,
      });
    }

    // Ako ne postoji igra koja čeka, kreiraj novu
    const [createResults] = await promisePool.query(
      `INSERT INTO games (created_by, status, table_type, bet_amount) 
       VALUES (?, 'waiting', ?, ?)`,
      [userId, tableType, betAmount]
    );

    const gameId = createResults.insertId;
    await promisePool.query(
      'INSERT INTO game_players (game_id, user_id, status) VALUES (?, ?, ?)',
      [gameId, userId, 'joined']
    );

    res.status(201).json({
      gameId,
      message: `Креирана нова игра типа ${tableType} са улогом од ${betAmount} токена`,
    });
  } catch (err) {
    console.error('Грешка при креирању или придруживању игри:', err);
    res.status(500).json({ error: 'Грешка у бази података' });
  }
});

// [2] Ruta za dobijanje informacija o igri
router.get('/:gameId', async (req, res) => {
  const { gameId } = req.params;

  try {
    const [results] = await promisePool.query(
      'SELECT * FROM games WHERE id = ?',
      [gameId]
    );

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
  } catch (err) {
    console.error('Greška prilikom dohvatanja igre:', err);
    res.status(500).json({ error: 'Greška u bazi podataka.' });
  }
});

// [3] Ruta za dobijanje ruke igrača **po gameId i playerId**
router.get('/:gameId/player/:playerId/hand', async (req, res) => {
  const { gameId, playerId } = req.params;

  try {
    const [results] = await promisePool.query(
      `SELECT hand 
       FROM game_players 
       WHERE game_id = ? 
         AND user_id = ? 
       LIMIT 1`,
      [gameId, playerId]
    );

    if (results.length === 0) {
      console.warn(`Ruka za igrača ${playerId} u igri ${gameId} nije pronađena.`);
      return res.status(404).json({ error: 'Ruka nije pronađena.' });
    }

    const hand = results[0].hand ? JSON.parse(results[0].hand) : [];
    res.status(200).json({ hand });
  } catch (err) {
    console.error('Greška prilikom dohvatanja ruke igrača:', err);
    res.status(500).json({ error: 'Greška u bazi podataka.' });
  }
});


// routes/games.js
router.get("/:gameId/full-state", async (req, res) => {
  try {
    const gameId = req.params.gameId;
    
    const [round] = await getActiveRound(gameId);
    const [players] = await getGamePlayers(gameId);
    const [currentRound] = await getCurrentRoundPlays(gameId);
    
    res.json({
      roundId: round.id,
      talonCards: round.talon_cards,
      licitacija: round.licitacija,
      trump: round.adut,
      scores: players.map(p => ({ userId: p.user_id, score: p.score })),
      players: players.map(p => ({
        userId: p.user_id,
        hand: JSON.parse(p.hand)
      })),
      activePlayerId: round.current_active_player,
      currentRound: currentRound
    });
    
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;