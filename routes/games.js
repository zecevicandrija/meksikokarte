const express = require('express');
const router = express.Router();
const db = require('../db');

// Kreiranje nove igre
router.post('/', (req, res) => {
    const { leaderId } = req.body;

    db.query(
        'INSERT INTO games (status, leader, created_at) VALUES (?, ?, NOW())',
        ['waiting', leaderId],
        (err, results) => {
            if (err) {
                console.error('Greška pri kreiranju igre:', err);
                res.status(500).send('Greška pri kreiranju igre');
            } else {
                res.status(201).json({ gameId: results.insertId });
            }
        }
    );
});

module.exports = router;
