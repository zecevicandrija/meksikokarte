module.exports = (io) => {
  const express = require('express');
  const router = express.Router();
  const { promisePool } = require('../db');

  // Funkcija koja bezbedno parsira JSON
  function safeParse(data) {
    if (data == null) return data;
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (e) {
        console.error('Greška pri parsiranju JSON-a:', e);
        return data;
      }
    }
    return data;
  }

  // GET /api/rounds/:gameId
  router.get('/:gameId', async (req, res) => {
    const { gameId } = req.params;

    try {
      // Dohvati poslednju rundu
      const [roundResults] = await promisePool.query(
        'SELECT * FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 1',
        [gameId]
      );

      if (roundResults.length === 0) {
        return res.status(404).json({ error: 'Runda nije pronađena.' });
      }

      const round = roundResults[0];

      // Dohvati ruke igrača
      const [playerResults] = await promisePool.query(
        'SELECT user_id, hand, score FROM game_players WHERE game_id = ?',
        [gameId]
      );

      // Parsiraj ruke igrača sa error handlingom
      const playerHands = playerResults.map(p => {
        let hand = [];
        try {
          // Proveri da li je hand string ili već objekat
          if (typeof p.hand === 'string') {
            hand = JSON.parse(p.hand);
          } else {
            hand = p.hand || [];
          }
        } catch (e) {
          console.error('Greška pri parsiranju ruke:', p.user_id, e);
          hand = [];
        }
        return {
          userId: p.user_id,
          hand,
          score: p.score
        };
      });

      // Sastavi odgovor koristeći safeParse za JSON polja
      res.status(200).json({
        roundId: round.id,
        talonCards: safeParse(round.talon_cards) || [],
        playerHands,
        licitacija: safeParse(round.licitacija),
        adut: round.adut,
        currentActivePlayer: round.current_active_player, // Dodato
      });

    } catch (err) {
      console.error('Greška pri dohvatu runde:', err);
      res.status(500).json({ error: 'Greška u bazi podataka.' });
    }
  });

  // POST /api/rounds/:gameId/start-round
  router.post('/:gameId/start-round', async (req, res) => {
    const { gameId } = req.params;
    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();
  
      // Zauzmi lock za igru (postojeći kod)
      const [lockResult] = await connection.query(
        'SELECT GET_LOCK(CONCAT("game_", ?), 10) AS locked',
        [gameId]
      );
      if (!lockResult[0]?.locked) {
        await connection.rollback();
        connection.release();
        return res.status(500).json({ error: 'Nije moguće zauzeti lock za igru.' });
      }
  
      // Proveri postojeću rundu (postojeći kod)
      const [activeRounds] = await connection.query(
        `SELECT * FROM rounds WHERE game_id = ? AND finished = 0
         AND JSON_EXTRACT(licitacija, '$.finished') = CAST('false' AS JSON) 
         ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [gameId]
      );
      if (activeRounds.length > 0) {
        await connection.commit();
        await connection.query('SELECT RELEASE_LOCK(CONCAT("game_", ?))', [gameId]);
        connection.release();
        return res.status(200).json({
          message: 'Aktivna runda već postoji',
          roundId: activeRounds[0].id,
        });
      }
  
      // Dohvati igrače i kreiraj player_order (postojeći kod)
      const [players] = await connection.query(
        'SELECT user_id FROM game_players WHERE game_id = ?',
        [gameId]
      );
      if (players.length < 3) {
        await connection.commit();
        await connection.query('SELECT RELEASE_LOCK(CONCAT("game_", ?))', [gameId]);
        connection.release();
        return res.status(200).json({
          message: 'Čekamo da se pridruže još igrači.',
          players: players.length,
        });
      }
  
      const [lastRound] = await connection.query(
        'SELECT player_order FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 1',
        [gameId]
      );
      
      let playerOrder;
      if (lastRound.length > 0) {
        // Rotiraj player_order iz prethodne runde
        const previousOrder = JSON.parse(lastRound[0].player_order);
        playerOrder = [...previousOrder.slice(1), previousOrder[0]];
      } else {
        // Prva runda - koristi originalni redosled
        const [players] = await connection.query(
          'SELECT user_id FROM game_players WHERE game_id = ?',
          [gameId]
        );
        playerOrder = players.map(p => p.user_id);
      }
      const licitacijaData = {
        playerOrder,
        currentPlayerIndex: 0,
        bids: Array(playerOrder.length).fill(null),
        minBid: 5,
        passedPlayers: [],
        finished: false,
      };
  
      // Dodaj current_active_player u INSERT upit
      const [insertResult] = await connection.query(
        `INSERT INTO rounds 
         (game_id, player_order, licitacija, current_active_player) 
         VALUES (?, ?, ?, ?)`,
        [gameId, JSON.stringify(playerOrder), JSON.stringify(licitacijaData), playerOrder[0]]
      );
  
      const roundId = insertResult.insertId;
  
      // Generiši i podeli karte (postojeći kod)
      const deck = generateDeck();
      const playerHands = [deck.slice(0, 10), deck.slice(10, 20), deck.slice(20, 30)];
      const talon = deck.slice(30, 32);
  
      const handUpdates = players.map((player, index) =>
        connection.query(
          'UPDATE game_players SET hand = ? WHERE user_id = ?',
          [JSON.stringify(playerHands[index]), player.user_id]
        )
      );
      await Promise.all(handUpdates);
  
      await connection.query(
        'UPDATE rounds SET talon_cards = ? WHERE id = ?',
        [JSON.stringify(talon), roundId]
      );
  
      // Završi transakciju
      await connection.commit();
      await connection.query('SELECT RELEASE_LOCK(CONCAT("game_", ?))', [gameId]);
      connection.release();
  
      // Emituj događaje
      io.to(`game_${gameId}`).emit('newRound', { roundId, playerOrder });
      io.to(`game_${gameId}`).emit('nextTurn', { nextPlayerId: playerOrder[0] });
  
      res.status(201).json({
        message: 'Nova runda uspešno kreirana.',
        roundId,
        licitacija: licitacijaData,
        nextPlayerId: playerOrder[0],
      });
    } catch (err) {
      await connection.rollback();
      await connection.query('SELECT RELEASE_LOCK(CONCAT("game_", ?))', [gameId]);
      connection.release();
      console.error('Greška pri pokretanju runde:', err);
      res.status(500).json({ error: 'Greška u bazi podataka.' });
    }
  });

  router.post('/:gameId/force-active-player', async (req, res) => {
  const { gameId } = req.params;
  const { playerId } = req.body;
  
  try {
    await promisePool.query(
      'UPDATE rounds SET current_active_player = ? WHERE game_id = ? ORDER BY id DESC LIMIT 1',
      [playerId, gameId]
    );
    res.status(200).json({ message: 'Aktivni igrač ažuriran' });
  } catch (error) {
    console.error('Greška pri ažuriranju aktivnog igrača:', error);
    res.status(500).json({ error: 'Greška u bazi' });
  }
});

  // Generisanje špila karata
  function generateDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck = [];

    for (const suit of suits) {
      for (const value of values) {
        deck.push({
          suit,
          value,
          image: `/Slike/${value}_${
            suit === '♠' ? 'spades' : suit === '♥' ? 'hearts' : suit === '♦' ? 'diamonds' : 'clubs'
          }.png`
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

  // POST /api/rounds/:gameId/set-trump
  router.post('/:gameId/set-trump', async (req, res) => {
    const { gameId } = req.params;
    const { adut } = req.body;

    if (!adut) {
      return res.status(400).json({ error: 'Adut nije prosleđen.' });
    }

    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Dohvati trenutnu licitaciju
      const [results] = await connection.query(
        'SELECT licitacija, player_order FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 1',
        [gameId]
      );

      if (results.length === 0) {
        throw new Error('Runda nije pronađena.');
      }

      const licitacija = safeParse(results[0].licitacija) || {};
      if (licitacija.noTrump) {
        return res.status(400).json({ error: 'Meksiko licitacija ne dozvoljava adut!' });
      }

      // Ažuriraj adut u rundi
      await connection.query(
        'UPDATE rounds SET adut = ? WHERE game_id = ? ORDER BY id DESC LIMIT 1',
        [adut, gameId]
      );

      const playerOrder = JSON.parse(results[0].player_order);
      const nextPlayerId = playerOrder[0]; // Prvi igrač nakon aduta
      
      await connection.commit();
      
      // Emituj ažuriran adut svim igračima
      io.to(`game_${gameId}`).emit('trumpUpdated', adut);
      io.to(`game_${gameId}`).emit('nextPlayer', { nextPlayerId });

      console.log(`Adut postavljen: ${adut}`);
      console.log(`Postavljen prvi igrač nakon aduta: ${nextPlayerId}`);

      res.status(200).json({ message: 'Adut uspešno postavljen.', adut });
    } catch (error) {
      await connection.rollback();
      console.error('Greška:', error);
      res.status(500).json({ error: 'Greška u bazi podataka.' });
    } finally {
      connection.release();
    }
  });

  // POST /api/rounds/:gameId/update-hand
  router.post('/:gameId/update-hand', async (req, res) => {
    const { gameId } = req.params;
    const { userId, newHand } = req.body;

    if (!userId || !newHand || !Array.isArray(newHand)) {
      return res.status(400).json({ error: 'Nevalidni podaci.' });
    }

    const handJSON = JSON.stringify(newHand);

    try {
      const [result] = await promisePool.query(
        'UPDATE game_players SET hand = ? WHERE game_id = ? AND user_id = ?',
        [handJSON, gameId, userId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Igrač nije pronađen u igri.' });
      }

      console.log(`Ruka igrača ${userId} ažurirana u igri ${gameId}.`);

      // Emituje događaj svim klijentima u igri
      io.to(`game_${gameId}`).emit('handUpdated', { userId, newHand });
      io.to(`game_${gameId}`).emit('hideTalon');

      res.status(200).json({ message: 'Ruka uspešno ažurirana.' });
    } catch (error) {
      console.error('Greška pri ažuriranju ruke igrača:', error);
      res.status(500).json({ error: 'Greška u bazi podataka.' });
    }
  });

  return router;
};
