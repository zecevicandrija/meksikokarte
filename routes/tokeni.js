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

// Nova ruta za dnevne tokene
router.post('/daily', (req, res) => {
  const { userId } = req.body;
  
  // Prvo probaj da ažuriraš postojeći red
  db.query(
    `UPDATE tokeni 
     SET 
       broj_tokena = IF(DATE(last_token_date) < CURDATE(), broj_tokena + 1000, broj_tokena),
       last_token_date = IF(DATE(last_token_date) < CURDATE(), NOW(), last_token_date)
     WHERE user_id = ?`,
    [userId],
    (updateErr, updateResult) => {
      if (updateErr) return res.status(500).json({ message: 'Greška u bazi', error: updateErr });

      // Proveri da li je update uspeo (da li postoji red)
      if (updateResult.affectedRows === 0) {
        // Ako ne postoji red, napravi novi
        db.query(
          `INSERT INTO tokeni (user_id, broj_tokena, last_token_date)
           VALUES (?, 1000, NOW())`,
          [userId],
          (insertErr) => {
            if (insertErr) return res.status(500).json({ message: 'Greška pri unosu', error: insertErr });
            
            // Vrati uspešan odgovor sa tokenima
            res.json({ tokeni: 1000 });
          }
        );
      } else {
        // Ako je update uspeo, dohvati ažurirane podatke
        db.query(
          'SELECT broj_tokena FROM tokeni WHERE user_id = ?',
          [userId],
          (selectErr, selectResults) => {
            if (selectErr) return res.status(500).json({ message: 'Greška pri dohvatanju' });
            res.json({ tokeni: selectResults[0].broj_tokena });
          }
        );
      }
    }
  );
});

module.exports = router;