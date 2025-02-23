const express = require('express');
const router = express.Router();
const { promisePool } = require('../db'); // Uvozimo promisePool iz db.js

// Dohvata tokene trenutnog korisnika
router.get('/moji', async (req, res) => {
  const userId = req.query.userId; // Додајемо параметар из URL-a

  if (!userId) {
    return res.status(401).json({ message: 'Niste prijavljeni' });
  }

  try {
    const [results] = await promisePool.query(
      'SELECT broj_tokena FROM tokeni WHERE user_id = ?',
      [userId]
    );

    res.json({ tokeni: results[0]?.broj_tokena || 0 });
  } catch (err) {
    console.error('Greška u bazi:', err);
    res.status(500).json({ message: 'Greška u bazi' });
  }
});

// Ruta za dodavanje tokena (bez admin provere na backendu)
router.post('/dodaj', async (req, res) => {
  const { userId, kolicina } = req.body;

  if (!userId || !kolicina) {
    return res.status(400).json({ message: 'Nedostaju obavezni podaci.' });
  }

  try {
    const [results] = await promisePool.query(
      'SELECT broj_tokena FROM tokeni WHERE user_id = ?',
      [userId]
    );

    const trenutnoTokena = results[0]?.broj_tokena || 0;
    const novoStanje = trenutnoTokena + kolicina;

    if (novoStanje < 0) {
      return res.status(400).json({ message: 'Nemate dovoljno tokena' });
    }

    await promisePool.query(
      `INSERT INTO tokeni (user_id, broj_tokena) VALUES (?, ?) 
       ON DUPLICATE KEY UPDATE broj_tokena = ?`,
      [userId, novoStanje, novoStanje]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Greška pri ažuriranju tokena:', err);
    res.status(500).json({ message: 'Greška u bazi' });
  }
});

// Nova ruta za dnevne tokene
router.post('/daily', async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: 'Nedostaje userId.' });
  }

  try {
    // Prvo probaj da ažuriraš postojeći red
    const [updateResult] = await promisePool.query(
      `UPDATE tokeni 
       SET 
         broj_tokena = IF(DATE(last_token_date) < CURDATE(), broj_tokena + 1000, broj_tokena),
         last_token_date = IF(DATE(last_token_date) < CURDATE(), NOW(), last_token_date)
       WHERE user_id = ?`,
      [userId]
    );

    // Proveri da li je update uspeo (da li postoji red)
    if (updateResult.affectedRows === 0) {
      // Ako ne postoji red, napravi novi
      await promisePool.query(
        `INSERT INTO tokeni (user_id, broj_tokena, last_token_date)
         VALUES (?, 1000, NOW())`,
        [userId]
      );

      res.json({ tokeni: 1000 });
    } else {
      // Ako je update uspeo, dohvati ažurirane podatke
      const [selectResults] = await promisePool.query(
        'SELECT broj_tokena FROM tokeni WHERE user_id = ?',
        [userId]
      );

      res.json({ tokeni: selectResults[0].broj_tokena });
    }
  } catch (err) {
    console.error('Greška pri dodeli dnevnih tokena:', err);
    res.status(500).json({ message: 'Greška u bazi', error: err });
  }
});

module.exports = router;