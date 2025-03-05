const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const { promisePool } = require('../db');
const jwt = require('jsonwebtoken');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google', async (req, res) => {
  // Preuzimamo token koji je klijent poslao
  const { token } = req.body;

  try {
    // Verifikujemo Google token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
      forceRefreshOfJWKs: true
    });

    // Dobijamo payload od Google-a
    const googlePayload = ticket.getPayload();

    // Parsiramo ime i prezime (ako je googlePayload.name dostupan)
    const [ime, ...prezimeParts] = googlePayload.name.split(' ');
    const prezime = prezimeParts.join(' ') || null;

    // Proveravamo da li korisnik već postoji (po google_id ili email)
    const [existingUser] = await promisePool.query(
      'SELECT * FROM korisnici WHERE google_id = ? OR email = ?',
      [googlePayload.sub, googlePayload.email]
    );

    if (existingUser.length > 0) {
      const user = existingUser[0];
      // Generišemo naš JWT token za korisnika (dinamički, sa našim secret-om)
      const jwtToken = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      return res.json({
        id: user.id,
        token: jwtToken,
        ime: user.ime,
        prezime: user.prezime || '',
        email: user.email,
        profilna: user.profilna
      });
    }

    // Ako korisnik ne postoji, kreiramo ga u bazi
    const [newUser] = await promisePool.query(
      `INSERT INTO korisnici 
        (ime, prezime, email, google_id, sifra, profilna, uloga) 
       VALUES (?, ?, ?, ?, NULL, ?, 'player')`,
      [ime, prezime, googlePayload.email, googlePayload.sub, googlePayload.picture]
    );

    // Generišemo JWT token za novokreiranog korisnika
    const jwtToken = jwt.sign(
      { userId: newUser.insertId, email: googlePayload.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(201).json({
      id: newUser.insertId,
      token: jwtToken,
      ime,
      email: googlePayload.email,
      profilna: googlePayload.picture
    });

  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Greška pri Google prijavi: ' + error.message });
  }
});

module.exports = router;
