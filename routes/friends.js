const express = require('express');
const router = express.Router();
const db = require('../db');

// [POST] /api/friends/request - šalje friend request
router.post('/request', (req, res) => {
  const { senderId, receiverId } = req.body;
  if (!senderId || !receiverId) {
    return res.status(400).json({ error: 'Nedostaju potrebni podaci.' });
  }

  const query = "INSERT INTO friend_requests (sender_id, receiver_id) VALUES (?, ?)";
  db.query(query, [senderId, receiverId], (err, results) => {
    if (err) {
      console.error("Greška pri slanju friend request-a:", err);
      return res.status(500).json({ error: "Greška u bazi podataka." });
    }
    res.json({ message: "Friend request poslat.", requestId: results.insertId });
  });
});

// [GET] /api/friends/requests/:userId - dohvata sve friend request-e (notifikacije) za korisnika
router.get('/requests/:userId', (req, res) => {
  const userId = req.params.userId;
  const query = `
    SELECT fr.id, fr.sender_id, k.ime AS senderIme, k.prezime AS senderPrezime, fr.status, fr.created_at
    FROM friend_requests fr
    JOIN korisnici k ON fr.sender_id = k.id
    WHERE fr.receiver_id = ? AND fr.status = 'pending'
    ORDER BY fr.created_at DESC
  `;
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("Greška pri dohvatanju friend request-a:", err);
      return res.status(500).json({ error: "Greška u bazi podataka." });
    }
    res.json(results);
  });
});

// [POST] /api/friends/respond - prihvata ili odbija friend request
router.post('/respond', (req, res) => {
  const { requestId, action } = req.body; // action: 'accepted' ili 'rejected'
  if (!requestId || !action) {
    return res.status(400).json({ error: 'Nedostaju potrebni podaci.' });
  }

  const query = "UPDATE friend_requests SET status = ? WHERE id = ?";
  db.query(query, [action, requestId], (err) => {
    if (err) {
      console.error("Greška pri odgovoru na friend request:", err);
      return res.status(500).json({ error: "Greška u bazi podataka." });
    }
    res.json({ message: `Friend request ${action}.` });
  });
});

// [GET] /api/friends/:userId - dohvata listu prijatelja
router.get('/:userId', (req, res) => {
  const userId = req.params.userId;
  const query = `
    SELECT k.id, k.ime, k.prezime, k.last_active,
           CASE WHEN k.last_active >= NOW() - INTERVAL 1 MINUTE THEN 1 ELSE 0 END AS online
    FROM korisnici k
    WHERE k.id IN (
      SELECT IF(sender_id = ?, receiver_id, sender_id)
      FROM friend_requests
      WHERE (sender_id = ? OR receiver_id = ?)
        AND status = 'accepted'
    )
  `;
  db.query(query, [userId, userId, userId], (err, results) => {
    if (err) {
      console.error("Greška pri dohvatanju liste prijatelja:", err);
      return res.status(500).json({ error: "Greška u bazi podataka." });
    }
    res.json(results);
  });
});

// [POST] /api/friends/remove - uklanja prijateljstvo (friend relationship)
router.post('/remove', (req, res) => {
    const { userId, friendId } = req.body;
    if (!userId || !friendId) {
      return res.status(400).json({ error: 'Nedostaju potrebni podaci.' });
    }
    
    // Brisanje zapisa koji predstavlja uspostavljeno prijateljstvo (status = 'accepted')
    const query = `
      DELETE FROM friend_requests 
      WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
        AND status = 'accepted'
    `;
    
    db.query(query, [userId, friendId, friendId, userId], (err, results) => {
      if (err) {
        console.error("Greška pri uklanjanju prijatelja:", err);
        return res.status(500).json({ error: "Greška u bazi podataka." });
      }
      res.json({ message: "Prijatelj uspešno uklonjen." });
    });
  });
  

module.exports = router;
