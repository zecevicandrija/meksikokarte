const express = require('express');
const router = express.Router();
const db = require('../db');

// Endpoint za dodavanje nove runde
router.post('/', (req, res) => {
    const { gameId, roundNumber, winner, playedCards } = req.body;
    const query = `
        INSERT INTO rounds (game_id, round_number, winner, played_cards) 
        VALUES (?, ?, ?, ?)
    `;
    db.query(query, [gameId, roundNumber, winner, JSON.stringify(playedCards)], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.status(201).json({ message: 'Round added successfully' });
    });
});

// Endpoint za dohvatanje runde
router.get('/:gameId/:roundNumber', (req, res) => {
    const { gameId, roundNumber } = req.params;
    const query = 'SELECT * FROM rounds WHERE game_id = ? AND round_number = ?';
    db.query(query, [gameId, roundNumber], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.status(200).json(results[0]);
    });
});

module.exports = router;
