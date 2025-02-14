// routes/istorija.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // prilagodi putanju do tvog db modula

// GET /api/istorija/:userId
router.get('/:userId', (req, res) => {
  const userId = parseInt(req.params.userId, 10); // konvertuj u broj

  // Prvo izbriši stare unose
  db.query("DELETE FROM istorija WHERE created_at < NOW() - INTERVAL 30 DAY", (deleteErr) => {
    if (deleteErr) {
      console.error("Greška pri brisanju starih istorija:", deleteErr);
      // Možeš nastaviti dalje, ako želiš
    }

    // Zatim dohvatimo istoriju partija za korisnika
    db.query(
      `SELECT * FROM istorija 
       WHERE JSON_CONTAINS(players, JSON_OBJECT('user_id', ?), '$')
       ORDER BY created_at DESC`,
      [userId],
      (error, results) => {
        if (error) {
          console.error('Greška pri dohvatanju istorije:', error);
          return res.status(500).json({ error: 'Došlo je do greške na serveru prilikom dohvatanja istorije.' });
        }
        res.json(results);
      }
    );
  });
});

module.exports = router;
