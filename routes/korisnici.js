const express = require('express');
const router = express.Router();
const db = require('../db'); // Tvoja konekcija sa bazom
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');

// Konfiguracija za multer - čuvanje slika
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Gde će se čuvati slike
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  }
});

const upload = multer({ storage });

// Endpoint za ažuriranje korisnika (sa slikom)
router.put('/update/:id', upload.single('slika'), async (req, res) => {
  const userId = req.params.id;
  const { ime, prezime, email, sifra, uloga } = req.body;
  const file = req.file;

  try {
    // Validacija - provera da li su polja ispunjena
    if (!ime || !prezime || !email || !uloga) {
      return res.status(400).json({ error: 'Nedostaju potrebni podaci' });
    }

    // Ako se menja lozinka, hashuj je
    let hashedPassword;
    if (sifra) {
      hashedPassword = await bcrypt.hash(sifra, 10);
    }

    // Pripremi upit za ažuriranje korisnika
    let query = 'UPDATE korisnici SET ime = ?, prezime = ?, email = ?, uloga = ?';
    let params = [ime, prezime, email, uloga];

    // Ako se menja lozinka, dodaj je u upit
    if (sifra) {
      query += ', sifra = ?';
      params.push(hashedPassword);
    }

    // Ako je slika poslata, dodaj je u upit
    if (file) {
      const imagePath = file.filename; // Naziv slike
      query += ', slika = ?';
      params.push(imagePath);
    }

    query += ' WHERE id = ?';
    params.push(userId);

    // Izvrši SQL upit
    db.query(query, params, (err, results) => {
      if (err) {
        console.error('Greška u bazi podataka:', err);
        return res.status(500).json({ error: 'Greška u bazi podataka' });
      }

      if (results.affectedRows === 0) {
        return res.status(404).json({ error: 'Korisnik nije pronađen' });
      }

      res.status(200).json({ message: 'Korisnik uspešno ažuriran' });
    });
  } catch (error) {
    console.error('Greška na serveru:', error);
    res.status(500).json({ error: 'Greška na serveru' });
  }
});

// Ruta za preuzimanje korisničkih slika
router.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Endpoint za dodavanje novog korisnika
router.post('/', async (req, res) => {
  const { ime, prezime, email, sifra, uloga } = req.body;

  try {
    if (!ime || !prezime || !email || !sifra || !uloga) {
      return res.status(400).json({ error: 'Nedostaju potrebni podaci' });
    }

    const hashedPassword = await bcrypt.hash(sifra, 10);

    const query = 'INSERT INTO korisnici (ime, prezime, email, sifra, uloga) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [ime, prezime, email, hashedPassword, uloga], (err, results) => {
      if (err) {
        console.error('Greška u bazi podataka:', err);
        return res.status(500).json({ error: 'Greška u bazi podataka' });
      }
      res.status(201).json({ message: 'Korisnik uspešno dodat', userId: results.insertId });
    });
  } catch (error) {
    console.error('Greška na serveru:', error);
    res.status(500).json({ error: 'Greška na serveru' });
  }
});



// Endpoint za dobavljanje svih korisnika
router.get('/', (req, res) => {
    const query = 'SELECT * FROM korisnici';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.status(200).json(results);
    });
});

// Endpoint za dodavanje novog korisnika
router.post('/', async (req, res) => {
    const { ime, prezime, email, sifra, uloga } = req.body;

    try {
        if (!ime || !prezime || !email || !sifra || !uloga) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const hashedPassword = await bcrypt.hash(sifra, 10);
        console.log('Hashed password:', hashedPassword);

        const query = 'INSERT INTO korisnici (ime, prezime, email, sifra, uloga) VALUES (?, ?, ?, ?, ?)';
        db.query(query, [ime, prezime, email, hashedPassword, uloga], (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            res.status(201).json({ message: 'User added successfully', userId: results.insertId });
        });
    } catch (error) {
        console.error('Internal server error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Endpoint za brisanje korisnika
router.delete('/:id', (req, res) => {
    const userId = req.params.id;
    const query = 'DELETE FROM korisnici WHERE id = ?';
    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.status(200).json({ message: `User with ID ${userId} deleted successfully` });
    });
});

module.exports = router;