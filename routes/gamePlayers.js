const express = require('express');
const router = express.Router();
const db = require('../db');

// Add a player to a game
router.post('/', (req, res) => {
    const { gameId, userId } = req.body;

    const query = 'INSERT INTO game_players (game_id, user_id, score) VALUES (?, ?, 0)';
    db.query(query, [gameId, userId], (err) => {
        if (err) {
            console.error('Error adding player:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        res.status(201).send('Player added successfully');
    });
});

// Get players by game ID
router.get('/:gameId', (req, res) => {
    const { gameId } = req.params;

    const query = 'SELECT * FROM game_players WHERE game_id = ?';
    db.query(query, [gameId], (err, results) => {
        if (err) {
            console.error('Error fetching players:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        res.status(200).json(results);
    });
});

module.exports = router;
