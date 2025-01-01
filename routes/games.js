const express = require("express");
const router = express.Router();
const db = require("../db"); // Database connection

// Create a new game
router.post("/", (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    console.error("UserId is required but not provided.");
    return res.status(400).json({ error: "UserId is required" });
  }

  console.log("Creating game for userId:", userId);

  // Insert the game
  const gameQuery = "INSERT INTO games (created_by) VALUES (?)";
  db.query(gameQuery, [userId], (err, gameResults) => {
    if (err) {
      console.error("Database error during game creation:", err.message);
      return res.status(500).json({ error: "Database error during game creation" });
    }

    const gameId = gameResults.insertId; // New game ID
    console.log("Game created with ID:", gameId);

    // Add the user to the game_players table
    const playerQuery = "INSERT INTO game_players (game_id, user_id, status) VALUES (?, ?, ?)";
    db.query(playerQuery, [gameId, userId, "joined"], (playerErr) => {
      if (playerErr) {
        console.error("Database error during player insertion:", playerErr.message);
        return res.status(500).json({ error: "Database error during player insertion" });
      }

      console.log(`Player ${userId} added to game ${gameId}`);
      res.status(201).json({ gameId });
    });
  });
});

// Test route to ensure the backend is working correctly
router.get("/test", (req, res) => {
  res.status(200).send("Games API is working!");
});

module.exports = router;
