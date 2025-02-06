// dostignuca.js (updated code)
const express = require('express');
const router = express.Router();
const db = require('../db'); // Ensure this points to the db.js file with queryAsync

const checkAchievements = async (userId) => {
  try {
    // Fetch total wins
    const winsQuery = `SELECT COUNT(*) AS totalWins FROM games WHERE pobednik = ?`;
    const [winsResult] = await db.queryAsync(winsQuery, [userId]); // Use queryAsync instead

    if (winsResult[0].totalWins >= 10) { // Adjust to access results correctly
      await db.queryAsync(
        'INSERT IGNORE INTO user_achievements (user_id, achievement_id) SELECT ?, id FROM achievements WHERE name = ?',
        [userId, 'Desetar']
      );
    }

    // Fetch active days
    const activeDaysQuery = `SELECT COUNT(DISTINCT DATE(login_time)) AS activeDays FROM user_logins WHERE user_id = ? AND login_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
    const [activeDaysResult] = await db.queryAsync(activeDaysQuery, [userId]);

    if (activeDaysResult[0].activeDays >= 7) {
      await db.queryAsync(
        'INSERT IGNORE INTO user_achievements (user_id, achievement_id) SELECT ?, id FROM achievements WHERE name = ?',
        [userId, 'Redovan']
      );
    }
  } catch (err) {
    console.error('Error checking achievements:', err);
  }
};

// Similarly update all other db.promise().query calls in the route handler
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    await checkAchievements(userId);

    const query = `SELECT a.name, a.description, ua.achieved_at FROM user_achievements ua JOIN achievements a ON ua.achievement_id = a.id WHERE ua.user_id = ?`;
    const [results] = await db.queryAsync(query, [userId]);

    res.json(results);
  } catch (err) {
    console.error('Error fetching achievements:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;