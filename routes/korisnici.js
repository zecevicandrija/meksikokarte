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

module.exports = router;
