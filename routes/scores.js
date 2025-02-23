const express = require('express');
const router = express.Router();
const { promisePool } = require('../db'); // Uvozimo promisePool iz db.js

// Endpoint za dodavanje rezultata igre
router.post('/', async (req, res) => {
  const { gameId, userId, score } = req.body;

  if (!gameId || !userId || !score) {
    return res.status(400).json({ error: 'Svi podaci su obavezni.' });
  }

  try {
    const [results] = await promisePool.query(
      'INSERT INTO scores (game_id, user_id, score) VALUES (?, ?, ?)',
      [gameId, userId, score]
    );

    res.status(201).json({ message: 'Rezultat uspešno dodat.', scoreId: results.insertId });
  } catch (err) {
    console.error('Greška u bazi:', err);
    res.status(500).json({ error: 'Greška u bazi podataka.' });
  }
});

// Endpoint za dohvatanje ukupnih rezultata igrača
router.get('/:userId', async (req, res) => {
  const userId = req.params.userId;

  try {
    const [results] = await promisePool.query(
      'SELECT * FROM scores WHERE user_id = ?',
      [userId]
    );

    res.status(200).json(results);
  } catch (err) {
    console.error('Greška u bazi:', err);
    res.status(500).json({ error: 'Greška u bazi podataka.' });
  }
});

module.exports = router;