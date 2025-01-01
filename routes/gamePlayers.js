const express = require('express');
const router = express.Router();
const db = require('../db');

// Dodavanje igrača u igru
router.post('/', (req, res) => {
    const { gameId, userId } = req.body;

    db.query(
        'INSERT INTO game_players (game_id, user_id, score) VALUES (?, ?, 0)',
        [gameId, userId],
        (err) => {
            if (err) {
                console.error(err);
                res.status(500).send('Greška pri dodavanju igrača');
            } else {
                res.status(201).send('Igrač dodat');
            }
        }
    );
});

module.exports = router;
