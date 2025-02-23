const express = require('express');
const router = express.Router();
const { promisePool } = require('../db'); // Uvozimo promisePool iz db.js

// GET /api/istorija/:userId
router.get('/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId, 10); // Konvertuj u broj

  try {
    // Prvo izbriši stare unose (starije od 30 dana)
    await promisePool.query(
      "DELETE FROM istorija WHERE created_at < NOW() - INTERVAL 30 DAY"
    );

    // Zatim dohvatimo istoriju partija za korisnika
    const [results] = await promisePool.query(
      `SELECT * FROM istorija 
       WHERE JSON_CONTAINS(players, JSON_OBJECT('user_id', ?), '$')
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json(results);
  } catch (error) {
    console.error('Greška pri dohvatanju istorije:', error);
    res.status(500).json({ error: 'Došlo je do greške na serveru prilikom dohvatanja istorije.' });
  }
});

module.exports = router;