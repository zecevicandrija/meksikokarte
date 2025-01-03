const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');

// Login endpoint
router.post('/login', async (req, res) => {
  const { email, sifra } = req.body;

  if (!email || !sifra) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  db.query('SELECT * FROM korisnici WHERE email = ?', [email], async (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = results[0];
    const isPasswordValid = await bcrypt.compare(sifra, user.sifra);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    console.log('Login successful, user:', user); // Debug log
    // Send user data without sensitive fields
    res.status(200).json({
      id: user.id,
      ime: user.ime,
      prezime: user.prezime,
      email: user.email,
      uloga: user.uloga,
    });
  });
});

// Ruta za registraciju korisnika
router.post('/', async (req, res) => {
  const { ime, prezime, email, sifra, uloga } = req.body;

  // Validacija podataka
  if (!ime || !prezime || !email || !sifra || !uloga) {
    return res.status(400).json({ error: 'Sva polja su obavezna.' });
  }

  try {
    // Proveri da li korisnik već postoji
    db.query('SELECT * FROM korisnici WHERE email = ?', [email], async (err, results) => {
      if (err) {
        console.error('Greška u bazi:', err);
        return res.status(500).json({ error: 'Greška u bazi podataka.' });
      }

      if (results.length > 0) {
        return res.status(409).json({ error: 'Korisnik sa ovim email-om već postoji.' });
      }

      // Hashuj lozinku
      const hashedPassword = await bcrypt.hash(sifra, 10);

      // Unesi novog korisnika u bazu
      const query = 'INSERT INTO korisnici (ime, prezime, email, sifra, uloga) VALUES (?, ?, ?, ?, ?)';
      db.query(query, [ime, prezime, email, hashedPassword, uloga], (err, results) => {
        if (err) {
          console.error('Greška prilikom dodavanja korisnika:', err);
          return res.status(500).json({ error: 'Greška u bazi podataka.' });
        }

        return res.status(201).json({ message: 'Korisnik je uspešno registrovan.' });
      });
    });
  } catch (error) {
    console.error('Greška na serveru:', error);
    res.status(500).json({ error: 'Greška na serveru.' });
  }
});

module.exports = router;
