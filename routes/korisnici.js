const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');

const multer = require('multer');
// Koristimo memory storage – fajl neće biti snimljen na disk
const storage = multer.memoryStorage();
const upload = multer({ storage });
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

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
    //console.log('Login successful, user:', user); // Debug log
    // Send user data without sensitive fields
    res.status(200).json({
      id: user.id,
      ime: user.ime,
      prezime: user.prezime,
      email: user.email,
      uloga: user.uloga,
      profilna: user.profilna,
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

// routes/korisnici.js - dodati ovo
router.get('/svikorisnici', (req, res) => {
  db.query('SELECT id, ime, prezime, email, uloga FROM korisnici', (err, results) => {
    if (err) return res.status(500).json({ error: 'Greska u bazi' });
    res.json(results);
  });
});

router.post('/upload-avatar', upload.single('avatar'), (req, res) => {
  const { userId } = req.body;
  if (!req.file) {
    return res.status(400).json({ error: 'Nije upload-ovana slika.' });
  }

  // Upload preko stream-a
  const uploadStream = cloudinary.uploader.upload_stream(
    {
      folder: 'user_avatars',
      public_id: `user_${userId}`,
      overwrite: true,
    },
    (error, result) => {
      if (error) {
        console.error('Cloudinary upload greška:', error);
        return res.status(500).json({ error: 'Greška prilikom upload-a na Cloudinary.' });
      }

      const imageUrl = result.secure_url;
      // Update korisnika u bazi – postavljamo polje 'profilna' na novi URL
      const query = 'UPDATE korisnici SET profilna = ? WHERE id = ?';
      db.query(query, [imageUrl, userId], (err, results) => {
        if (err) {
          console.error('Greška pri update-u baze:', err);
          return res.status(500).json({ error: 'Greška pri update-u baze podataka.' });
        }
        return res.status(200).json({ message: 'Avatar uspešno postavljen', url: imageUrl });
      });
    }
  );

  // Pretvaramo buffer u stream i šaljemo ga Cloudinary-ju
  streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT id, ime, prezime, email, uloga, profilna FROM korisnici WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('Greška u bazi:', err);
      return res.status(500).json({ error: 'Greška u bazi podataka.' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Korisnik nije pronađen.' });
    }
    res.json(results[0]);
  });
});



module.exports = router;
