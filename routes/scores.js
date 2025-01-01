const express = require('express');
const router = express.Router();
const db = require('../db');

// Endpoint za dodavanje rezultata igre
router.post('/', (req, res) => {
    const { gameId, userId, score } = req.body;
    const query = 'INSERT INTO scores (game_id, user_id, score) VALUES (?, ?, ?)';
    db.query(query, [gameId, userId, score], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.status(201).json({ message: 'Score added successfully' });
    });
});

// Endpoint za dohvatanje ukupnih rezultata igrača
router.get('/:userId', (req, res) => {
    const userId = req.params.userId;
    const query = 'SELECT * FROM scores WHERE user_id = ?';
    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.status(200).json(results);
    });
});

module.exports = router;
