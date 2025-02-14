const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfPeriod = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const query = `
    SELECT 
      k.id,
      k.ime,
      k.prezime,
      COALESCE(SUM(gp.score), 0) AS total_score
    FROM korisnici k
    LEFT JOIN game_players gp ON k.id = gp.user_id
      AND gp.game_id IN (
        SELECT id 
        FROM games 
        WHERE created_at BETWEEN '${startOfMonth.toISOString().slice(0, 19).replace('T', ' ')}' 
          AND '${endOfPeriod.toISOString().slice(0, 19).replace('T', ' ')}'
      )
    GROUP BY k.id
    ORDER BY total_score DESC
    LIMIT 10
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Greška:', err);
      return res.status(500).json({ error: 'Greška u bazi' });
    }
    res.json(results);
  });
});

module.exports = router;