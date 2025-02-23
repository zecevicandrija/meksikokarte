const express = require('express');
const router = express.Router();
const { promisePool } = require('../db'); // Uvozimo promisePool iz db.js

// [POST] /api/friends/request
router.post('/request', async (req, res) => {
  const { senderId, receiverId } = req.body;
  if (!senderId || !receiverId) {
    return res.status(400).json({ error: 'Nedostaju potrebni podaci.' });
  }

  try {
    const [results] = await promisePool.query(
      "INSERT INTO friend_requests (sender_id, receiver_id) VALUES (?, ?)",
      [senderId, receiverId]
    );
    res.json({ message: "Friend request poslat.", requestId: results.insertId });
  } catch (err) {
    console.error("Greška pri slanju friend request-a:", err);
    res.status(500).json({ error: "Greška u bazi podataka." });
  }
});

// [GET] /api/friends/requests/:userId
router.get('/requests/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const [results] = await promisePool.query(
      `SELECT fr.id, fr.sender_id, k.ime AS senderIme, k.prezime AS senderPrezime, fr.status, fr.created_at
       FROM friend_requests fr
       JOIN korisnici k ON fr.sender_id = k.id
       WHERE fr.receiver_id = ? AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [userId]
    );
    res.json(results);
  } catch (err) {
    console.error("Greška pri dohvatanju friend request-a:", err);
    res.status(500).json({ error: "Greška u bazi podataka." });
  }
});

// [POST] /api/friends/respond
router.post('/respond', async (req, res) => {
  const { requestId, action } = req.body;
  if (!requestId || !action) {
    return res.status(400).json({ error: 'Nedostaju potrebni podaci.' });
  }

  try {
    await promisePool.query(
      "UPDATE friend_requests SET status = ? WHERE id = ?",
      [action, requestId]
    );
    res.json({ message: `Friend request ${action}.` });
  } catch (err) {
    console.error("Greška pri odgovoru na friend request:", err);
    res.status(500).json({ error: "Greška u bazi podataka." });
  }
});

// [GET] /api/friends/:userId
router.get('/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const [results] = await promisePool.query(
      `SELECT k.id, k.ime, k.prezime, k.last_active,
              CASE WHEN k.last_active >= NOW() - INTERVAL 1 MINUTE THEN 1 ELSE 0 END AS online
       FROM korisnici k
       WHERE k.id IN (
         SELECT IF(sender_id = ?, receiver_id, sender_id)
         FROM friend_requests
         WHERE (sender_id = ? OR receiver_id = ?)
           AND status = 'accepted'
       )`,
      [userId, userId, userId]
    );
    res.json(results);
  } catch (err) {
    console.error("Greška pri dohvatanju liste prijatelja:", err);
    res.status(500).json({ error: "Greška u bazi podataka." });
  }
});

// [POST] /api/friends/remove
router.post('/remove', async (req, res) => {
  const { userId, friendId } = req.body;
  if (!userId || !friendId) {
    return res.status(400).json({ error: 'Nedostaju potrebni podaci.' });
  }

  try {
    await promisePool.query(
      `DELETE FROM friend_requests 
       WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
         AND status = 'accepted'`,
      [userId, friendId, friendId, userId]
    );
    res.json({ message: "Prijatelj uspešno uklonjen." });
  } catch (err) {
    console.error("Greška pri uklanjanju prijatelja:", err);
    res.status(500).json({ error: "Greška u bazi podataka." });
  }
});

module.exports = router;