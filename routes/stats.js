const express = require('express');
const router = express.Router();
const { promisePool } = require('../db'); // Uvozimo promisePool iz db.js

router.get('/:userId', async (req, res) => {
  const { userId } = req.params;

  // Odredi početak i kraj trenutnog meseca
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Formatiraj datume u MySQL format: "YYYY-MM-DD HH:MM:SS"
  const formatDate = (date) => {
    return date.toISOString().slice(0, 19).replace('T', ' ');
  };
  const startOfMonthStr = formatDate(startOfMonth);
  const startOfNextMonthStr = formatDate(startOfNextMonth);

  try {
    // 1. Ukupno odigranih partija (svi zapisi u game_players za korisnika)
    const [totalOverallResults] = await promisePool.query(
      `SELECT COUNT(*) AS totalGamesOverall
       FROM game_players
       WHERE user_id = ?`,
      [userId]
    );

    // 2. Ukupno pobeda (svi zapisi u games gde je pobednik = userId)
    const [winsOverallResults] = await promisePool.query(
      `SELECT COUNT(*) AS totalWinsOverall
       FROM games
       WHERE pobednik = ?`,
      [userId]
    );

    // 3. Ukupno odigranih partija u ovom mesecu (spajanjem na games.created_at)
    const [totalMonthResults] = await promisePool.query(
      `SELECT COUNT(*) AS totalGamesMonth
       FROM game_players gp
       JOIN games g ON gp.game_id = g.id
       WHERE gp.user_id = ?
         AND g.created_at >= ?
         AND g.created_at < ?`,
      [userId, startOfMonthStr, startOfNextMonthStr]
    );

    // 4. Ukupno poena u ovom mesecu
    const [scoreMonthResults] = await promisePool.query(
      `SELECT COALESCE(SUM(gp.score), 0) AS totalScoreMonth
       FROM game_players gp
       JOIN games g ON gp.game_id = g.id
       WHERE gp.user_id = ?
         AND g.created_at >= ?
         AND g.created_at < ?`,
      [userId, startOfMonthStr, startOfNextMonthStr]
    );

    // 5. Broj pobeda u ovom mesecu
    const [winsMonthResults] = await promisePool.query(
      `SELECT COUNT(*) AS winsMonth
       FROM games
       WHERE pobednik = ?
         AND created_at >= ?
         AND created_at < ?`,
      [userId, startOfMonthStr, startOfNextMonthStr]
    );

    // 6. Čitanje vrednosti "najbolji_mesec" iz tabele korisnici
    const [bestMonthResults] = await promisePool.query(
      `SELECT najbolji_mesec
       FROM korisnici
       WHERE id = ?`,
      [userId]
    );

    res.json({
      totalGamesOverall: totalOverallResults[0].totalGamesOverall,
      totalWinsOverall: winsOverallResults[0].totalWinsOverall,
      totalGamesMonth: totalMonthResults[0].totalGamesMonth,
      totalScoreMonth: scoreMonthResults[0].totalScoreMonth,
      winsMonth: winsMonthResults[0].winsMonth,
      bestMonth: bestMonthResults.length > 0 ? bestMonthResults[0].najbolji_mesec : 0,
    });
  } catch (err) {
    console.error('Greška pri dohvatanju statistike:', err);
    res.status(500).json({ error: 'Greška u bazi podataka.' });
  }
});

module.exports = router;