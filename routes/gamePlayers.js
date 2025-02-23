const express = require('express');
const router = express.Router();
const { promisePool } = require('../db'); // Uvozimo promisePool iz db.js

// [POST] Dodaj igrača u igru
router.post('/', async (req, res) => {
    const { gameId, userId } = req.body;

    // Validacija ulaznih podataka
    if (!gameId || !userId) {
        return res.status(400).json({ error: 'Nedostaju gameId ili userId.' });
    }

    try {
        // Dodaj igrača u igru sa početnim skorom 0
        const [results] = await promisePool.query(
            'INSERT INTO game_players (game_id, user_id, score) VALUES (?, ?, 0)',
            [gameId, userId]
        );

        res.status(201).json({ message: 'Igrač uspešno dodat.', playerId: results.insertId });
    } catch (err) {
        console.error('Greška pri dodavanju igrača:', err);
        res.status(500).json({ error: 'Greška u bazi podataka.' });
    }
});

// [GET] Dohvati igrače po ID-u igre
router.get('/:gameId', async (req, res) => {
    const { gameId } = req.params;

    try {
        // Dohvati sve igrače za datu igru
        const [results] = await promisePool.query(
            'SELECT * FROM game_players WHERE game_id = ?',
            [gameId]
        );

        res.status(200).json(results);
    } catch (err) {
        console.error('Greška pri dohvatanju igrača:', err);
        res.status(500).json({ error: 'Greška u bazi podataka.' });
    }
});

module.exports = router;