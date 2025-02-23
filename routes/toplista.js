const express = require('express');
const router = express.Router();
const { promisePool } = require('../db'); // Uvozimo promisePool iz db.js

router.get('/', async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfPeriod = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  // Formatiraj datume u MySQL format: "YYYY-MM-DD HH:MM:SS"
  const formatDate = (date) => {
    return date.toISOString().slice(0, 19).replace('T', ' ');
  };
  const startOfMonthStr = formatDate(startOfMonth);
  const endOfPeriodStr = formatDate(endOfPeriod);

  try {
    const [results] = await promisePool.query(
      `SELECT 
         k.id,
         k.ime,
         k.prezime,
         COALESCE(SUM(gp.score), 0) AS total_score
       FROM korisnici k
       LEFT JOIN game_players gp ON k.id = gp.user_id
         AND gp.game_id IN (
           SELECT id 
           FROM games 
           WHERE created_at BETWEEN ? AND ?
         )
       GROUP BY k.id
       ORDER BY total_score DESC
       LIMIT 5`,
      [startOfMonthStr, endOfPeriodStr]
    );

    res.json(results);
  } catch (err) {
    console.error('Greška pri dohvatanju top liste:', err);
    res.status(500).json({ error: 'Greška u bazi podataka.' });
  }
});

module.exports = router;