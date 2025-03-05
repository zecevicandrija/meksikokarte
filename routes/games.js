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

const generateUniqueCode = async () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 10; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    const [results] = await promisePool.query('SELECT id FROM games WHERE code = ?', [code]);
    if (results.length === 0) {
      return code;
    }
  } while (true);
};

// [1] Ruta za kreiranje ili pridruživanje igri
router.post('/', async (req, res) => {
  const { userId, tableType, betAmount, isPrivate } = req.body;

  if (!userId || !tableType || !betAmount) {
    return res.status(400).json({ error: 'Недостају потребни подаци' });
  }

  try {
    let gameId;
    let code = null;

    if (isPrivate) {
      // For private games, always create a new game
      code = await generateUniqueCode();
      const [createResults] = await promisePool.query(
        `INSERT INTO games (created_by, status, table_type, bet_amount, code) 
         VALUES (?, 'waiting', ?, ?, ?)`,
        [userId, tableType, betAmount, code]
      );
      gameId = createResults.insertId;

      await promisePool.query(
        'INSERT INTO game_players (game_id, user_id, status) VALUES (?, ?, ?)',
        [gameId, userId, 'joined']
      );

      return res.status(201).json({
        gameId,
        code, // Return the code for the creator
        message: `Креирана приватна игра типа ${tableType} са улогом од ${betAmount} токена`,
      });
    }

    // Existing logic for public games
    const [results] = await promisePool.query(
      `SELECT g.id AS gameId, COUNT(gp.id) AS playerCount 
       FROM games g
       LEFT JOIN game_players gp ON g.id = gp.game_id
       WHERE g.status = 'waiting'
         AND g.table_type = ?
         AND g.bet_amount = ?
         AND g.code IS NULL
       GROUP BY g.id
       HAVING playerCount < 3
       LIMIT 1`,
      [tableType, betAmount]
    );

    if (results.length > 0) {
      gameId = results[0].gameId;
      await promisePool.query(
        'INSERT INTO game_players (game_id, user_id, status) VALUES (?, ?, ?)',
        [gameId, userId, 'joined']
      );

      return res.json({
        gameId,
        message: `Ушли сте у игру типа ${tableType} са улогом од ${betAmount} токена`,
      });
    }

    const [createResults] = await promisePool.query(
      `INSERT INTO games (created_by, status, table_type, bet_amount) 
       VALUES (?, 'waiting', ?, ?)`,
      [userId, tableType, betAmount]
    );
    gameId = createResults.insertId;

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

router.post('/join-private', async (req, res) => {
  const { userId, code } = req.body;

  if (!userId || !code) {
    return res.status(400).json({ error: 'Недостају кориснички ID или код' });
  }

  try {
    const [results] = await promisePool.query(
      'SELECT id FROM games WHERE code = ? AND status = "waiting"',
      [code]
    );

    if (results.length === 0) {
      return res.status(404).json({ error: 'Игра није пронађена или је већ почела.' });
    }

    const gameId = results[0].id;

    const [playerResults] = await promisePool.query(
      'SELECT id FROM game_players WHERE game_id = ? AND user_id = ?',
      [gameId, userId]
    );
    if (playerResults.length > 0) {
      return res.status(400).json({ error: 'Већ сте у овој игри.' });
    }

    const [countResults] = await promisePool.query(
      'SELECT COUNT(*) as playerCount FROM game_players WHERE game_id = ?',
      [gameId]
    );
    if (countResults[0].playerCount >= 3) {
      return res.status(400).json({ error: 'Игра је пуна.' });
    }

    await promisePool.query(
      'INSERT INTO game_players (game_id, user_id, status) VALUES (?, ?, ?)',
      [gameId, userId, 'joined']
    );

    res.json({ gameId, message: 'Успешно сте se придружили приватној игри.' });
  } catch (err) {
    console.error('Грешка при придруживању приватној игри:', err);
    res.status(500).json({ error: 'Грешка u бази података.' });
  }
});

router.post('/:gameId/finish', async (req, res) => {
  const { gameId } = req.params;

  try {
    // Počni transakciju za konzistentnost podataka
    await promisePool.query('START TRANSACTION');

    // Dohvati detalje igre
    const [gameResults] = await promisePool.query(
      'SELECT bet_amount, code FROM games WHERE id = ?',
      [gameId]
    );
    if (gameResults.length === 0) {
      await promisePool.query('ROLLBACK');
      return res.status(404).json({ error: 'Igra nije pronađena.' });
    }
    const { bet_amount, code } = gameResults[0];
    const isPrivate = code !== null;

    if (isPrivate) {
      // Privatna igra, bez dodele tokena
      await promisePool.query('UPDATE games SET status = "finished" WHERE id = ?', [gameId]);
      await promisePool.query('COMMIT');
      return res.json({ message: 'Privatna igra završena bez dodele tokena.' });
    }

    // Dohvati bodove igrača
    const [playerResults] = await promisePool.query(
      'SELECT user_id, score FROM game_players WHERE game_id = ?',
      [gameId]
    );
    if (playerResults.length !== 3) {
      await promisePool.query('ROLLBACK');
      return res.status(400).json({ error: 'Igra mora imati tačno 3 igrača.' });
    }

    // Sortiraj igrače po bodovima (opadajuće)
    const sortedPlayers = playerResults.sort((a, b) => b.score - a.score);

    // Odredi rangiranje
    const first = sortedPlayers[0];
    const second = sortedPlayers[1];
    const third = sortedPlayers[2];

    // Izračunaj nagrade
    let prizes = {
      [first.user_id]: Math.round(3 * bet_amount),  // Pobednik: 2.5 × ulog
      [second.user_id]: Math.round(0.5 * bet_amount), // Drugi: 0.5 × ulog
      [third.user_id]: 0                              // Treći: 0
    };

    // Proveri izjednačenje između drugog i trećeg
    if (second.score === third.score) {
      const sharedPrize = Math.round((0.5 * bet_amount) / 2);
      prizes[second.user_id] = sharedPrize;
      prizes[third.user_id] = sharedPrize;
    }

    // Dodeli tokene
    for (const [userId, prize] of Object.entries(prizes)) {
      if (prize > 0) {
        await promisePool.query(
          `INSERT INTO tokeni (user_id, broj_tokena) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE broj_tokena = broj_tokena + ?`,
          [userId, prize, prize]
        );
      }
    }

    // Ažuriraj status igre
    await promisePool.query('UPDATE games SET status = "finished" WHERE id = ?', [gameId]);

    await promisePool.query('COMMIT');
    res.json({ message: 'Igra završena i tokeni dodeljeni.' });
  } catch (err) {
    await promisePool.query('ROLLBACK');
    console.error('Greška pri završetku igre:', err);
    res.status(500).json({ error: 'Greška u bazi podataka.' });
  }
});

module.exports = router;