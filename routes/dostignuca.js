// dostignuca.js
const express = require('express');
const router = express.Router();
const { promisePool } = require('../db'); // Koristimo promisePool iz mysql2

const checkAchievements = async (userId) => {
  try {
    // Provera dostignuća "Desetar"
    const winsQuery = `SELECT COUNT(*) AS totalWins FROM games WHERE pobednik = ?`;
    const [winsResult] = await promisePool.query(winsQuery, [userId]);
    
    if (winsResult[0].totalWins >= 10) {
      await promisePool.query(
        `INSERT IGNORE INTO user_achievements (user_id, achievement_id)
         SELECT ?, id FROM achievements WHERE name = 'Desetar'`,
        [userId]
      );
    }

    // Provera dostignuća "Redovan"
    const activeDaysQuery = `
      SELECT COUNT(DISTINCT DATE(login_time)) AS activeDays 
      FROM user_logins 
      WHERE user_id = ? AND login_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `;
    const [activeDaysResult] = await promisePool.query(activeDaysQuery, [userId]);
    
    if (activeDaysResult[0].activeDays >= 7) {
      await promisePool.query(
        `INSERT IGNORE INTO user_achievements (user_id, achievement_id)
         SELECT ?, id FROM achievements WHERE name = 'Redovan'`,
        [userId]
      );
    }
  } catch (err) {
    console.error('Greška pri proveri dostignuća:', err);
    throw err; // Prosleđujemo grešku dalje da bi je rukovalac rute uhvatio
  }
};

router.get('/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    await checkAchievements(userId);

    const query = `
      SELECT a.name, a.description, ua.achieved_at 
      FROM user_achievements ua 
      JOIN achievements a ON ua.achievement_id = a.id 
      WHERE ua.user_id = ?
    `;
    const [results] = await promisePool.query(query, [userId]);

    res.json(results);
  } catch (err) {
    console.error('Greška pri dohvatanju dostignuća:', err);
    res.status(500).json({ error: 'Greška u bazi podataka' });
  }
});

module.exports = router;