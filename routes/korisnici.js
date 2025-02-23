const express = require('express');
const router = express.Router();
const { promisePool } = require('../db'); // Uvozimo promisePool iz db.js
const bcrypt = require('bcryptjs');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// Konfiguracija za multer i cloudinary ostaje ista
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Login endpoint s mysql2
router.post('/login', async (req, res) => {
  const { email, sifra } = req.body;

  if (!email || !sifra) {
    return res.status(400).json({ error: 'Email i šifra su obavezni' });
  }

  try {
    const [results] = await promisePool.query(
      'SELECT * FROM korisnici WHERE email = ?',
      [email]
    );

    if (results.length === 0) {
      return res.status(401).json({ error: 'Pogrešan email ili šifra' });
    }

    const user = results[0];
    const isPasswordValid = await bcrypt.compare(sifra, user.sifra);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Pogrešan email ili šifra' });
    }

    res.status(200).json({
      id: user.id,
      ime: user.ime,
      prezime: user.prezime,
      email: user.email,
      uloga: user.uloga,
      profilna: user.profilna,
    });
  } catch (err) {
    console.error('Greška u bazi:', err);
    res.status(500).json({ error: 'Greška u bazi podataka' });
  }
});

// Registracija korisnika s mysql2
router.post('/', async (req, res) => {
  const { ime, prezime, email, sifra, uloga } = req.body;

  if (!ime || !prezime || !email || !sifra || !uloga) {
    return res.status(400).json({ error: 'Sva polja su obavezna' });
  }

  try {
    // Proveri da li korisnik već postoji
    const [results] = await promisePool.query(
      'SELECT * FROM korisnici WHERE email = ?',
      [email]
    );

    if (results.length > 0) {
      return res.status(409).json({ error: 'Email već postoji' });
    }

    // Hashuj lozinku
    const hashedPassword = await bcrypt.hash(sifra, 10);

    // Unesi novog korisnika u bazu
    const [insertResults] = await promisePool.query(
      'INSERT INTO korisnici (ime, prezime, email, sifra, uloga) VALUES (?, ?, ?, ?, ?)',
      [ime, prezime, email, hashedPassword, uloga]
    );

    res.status(201).json({ message: 'Registracija uspješna', userId: insertResults.insertId });
  } catch (err) {
    console.error('Greška pri registraciji:', err);
    res.status(500).json({ error: 'Greška u bazi podataka' });
  }
});

// Dohvat svih korisnika
router.get('/svikorisnici', async (req, res) => {
  try {
    const [results] = await promisePool.query(
      'SELECT id, ime, prezime, email, uloga FROM korisnici'
    );
    res.json(results);
  } catch (err) {
    console.error('Greška u bazi:', err);
    res.status(500).json({ error: 'Greška u bazi podataka' });
  }
});

// Upload avatara (ostaje isti jer koristi stream)
router.post('/upload-avatar', upload.single('avatar'), async (req, res) => {
  const { userId } = req.body;
  if (!req.file) {
    return res.status(400).json({ error: 'Nema uploadovane slike' });
  }

  const uploadStream = cloudinary.uploader.upload_stream(
    {
      folder: 'user_avatars',
      public_id: `user_${userId}`,
      overwrite: true,
    },
    async (error, result) => {
      if (error) {
        console.error('Cloudinary greška:', error);
        return res.status(500).json({ error: 'Greška pri uploadu' });
      }

      try {
        await promisePool.query(
          'UPDATE korisnici SET profilna = ? WHERE id = ?',
          [result.secure_url, userId]
        );
        res.json({ message: 'Avatar ažuriran', url: result.secure_url });
      } catch (err) {
        console.error('Greška pri update-u:', err);
        res.status(500).json({ error: 'Greška u bazi podataka' });
      }
    }
  );

  streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
});

// Dohvat pojedinačnog korisnika
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [results] = await promisePool.query(
      'SELECT id, ime, prezime, email, uloga, profilna FROM korisnici WHERE id = ?',
      [id]
    );

    if (results.length === 0) {
      return res.status(404).json({ error: 'Korisnik nije pronađen' });
    }

    res.json(results[0]);
  } catch (err) {
    console.error('Greška u bazi:', err);
    res.status(500).json({ error: 'Greška u bazi podataka' });
  }
});

// Ažuriranje last_active
router.post('/update-last-active', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'UserId je obavezan' });

  try {
    await promisePool.query(
      'UPDATE korisnici SET last_active = CURRENT_TIMESTAMP WHERE id = ?',
      [userId]
    );
    res.json({ message: 'Aktivnost ažurirana' });
  } catch (err) {
    console.error('Greška pri ažuriranju:', err);
    res.status(500).json({ error: 'Greška u bazi podataka' });
  }
});

module.exports = router;