const express = require('express');
const router = express.Router();
const db = require('../db');

// Dohvata tokene trenutnog korisnika
router.get('/moji', (req, res) => {
  const userId = req.query.userId; // Додајемо параметар из URL-a
  
  if (!userId) {
    return res.status(401).json({ message: 'Niste prijavljeni' });
  }

  db.query(
    'SELECT broj_tokena FROM tokeni WHERE user_id = ?',
    [userId],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Greska u bazi' });
      res.json({ tokeni: results[0]?.broj_tokena || 0 });
    }
  );
});

// Ruta za dodavanje tokena (bez admin provere na backendu)
router.post('/dodaj', (req, res) => {
  const { userId, kolicina } = req.body;

  db.query('SELECT broj_tokena FROM tokeni WHERE user_id = ?', [userId], 
    (err, results) => {
      if(err) return res.status(500).json({ message: 'Greška u bazi' });
      
      const trenutnoTokena = results[0]?.broj_tokena || 0;
      const novoStanje = trenutnoTokena + kolicina;

      if(novoStanje < 0) {
        return res.status(400).json({ message: 'Nemate dovoljno tokena' });
      }

      db.query(
        'INSERT INTO tokeni (user_id, broj_tokena) VALUES (?, ?) ' +
        'ON DUPLICATE KEY UPDATE broj_tokena = ?',
        [userId, novoStanje, novoStanje],
        (err) => {
          if(err) return res.status(500).json({ message: 'Greška pri ažuriranju' });
          res.json({ success: true });
        }
      );
    }
  );
});

module.exports = router;