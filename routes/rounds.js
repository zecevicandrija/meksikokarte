// routes/rounds.js
module.exports = function(io) {
  const express = require('express');
  const router = express.Router();
  const db = require('../db');


  router.get('/:gameId', (req, res) => {
    const { gameId } = req.params;
  
    db.query(
      'SELECT * FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 1',
      [gameId],
      (err, results) => {
        if (err) {
          console.error('Greška pri dohvatu runde:', err);
          return res.status(500).json({ error: 'Greška u bazi podataka.' });
        }
  
        if (results.length === 0) {
          return res.status(404).json({ error: 'Runda nije pronađena.' });
        }
  
        const round = results[0];
  
        // Dohvati ruke igrača
        db.query(
          'SELECT user_id, hand FROM game_players WHERE game_id = ?',
          [gameId],
          (playerErr, players) => {
            if (playerErr) {
              console.error('Greška pri dohvatanju ruku igrača:', playerErr);
              return res.status(500).json({ error: 'Greška u bazi podataka.' });
            }
  
            const playerHands = players.map((p) => ({
              userId: p.user_id,
              hand: p.hand ? JSON.parse(p.hand) : [],
            }));
  
            res.status(200).json({
              roundId: round.id,
              talonCards: round.talon_cards ? JSON.parse(round.talon_cards) : [],
              playerHands,
              licitacija: round.licitacija ? JSON.parse(round.licitacija) : null,
              adut: round.adut, // Dodato
            });
          }
        );
      }
    );
  });
  
  
  //  /api/rounds/:gameId/start-round
  router.post("/:gameId/start-round", (req, res) => {
    const { gameId } = req.params;
  
    // Check if a round already exists
    db.query(
      "SELECT * FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 1",
      [gameId],
      (err, results) => {
        if (err) {
          console.error("Error fetching the active round:", err);
          return res.status(500).json({ error: "Database error." });
        }
  
        // If no active round, create a new one
        if (results.length === 0 || JSON.parse(results[0].licitacija).finished) {
          // Fetch all players
          db.query(
            "SELECT user_id FROM game_players WHERE game_id = ?",
            [gameId],
            (playerErr, players) => {
              if (playerErr) {
                console.error("Error fetching players:", playerErr);
                return res.status(500).json({ error: "Database error." });
              }
  
              if (players.length < 3) {
                return res.status(200).json({
                  message: "Waiting for more players to join.",
                  players: players.length,
                });
              }
  
              // Create a new round
              const playerOrder = players.map((p) => p.user_id);
              const licitacijaData = {
                playerOrder,
                currentPlayerIndex: 0,
                bids: Array(playerOrder.length).fill(null),
                minBid: 5,
                passedPlayers: [],
                finished: false,
              };
  
              db.query(
                "INSERT INTO rounds (game_id, player_order, licitacija) VALUES (?, ?, ?)",
                [gameId, JSON.stringify(playerOrder), JSON.stringify(licitacijaData)],
                (insertErr, result) => {
                  if (insertErr) {
                    console.error("Error creating a new round:", insertErr);
                    return res
                      .status(500)
                      .json({ error: "Database error." });
                  }
  
                  const roundId = result.insertId;
  
                  // Update round_id for all players and deal cards
                  const deck = generateDeck();
                  const playerHands = [
                    deck.slice(0, 10),
                    deck.slice(10, 20),
                    deck.slice(20, 30),
                  ];
                  const talon = deck.slice(30, 32);
  
                  const handPromises = players.map((player, index) => {
                    const handJSON = JSON.stringify(playerHands[index] || []);
                    return new Promise((resolve, reject) => {
                      db.query(
                        "UPDATE game_players SET hand = ? WHERE user_id = ?",
                        [handJSON, player.user_id],
                        (handErr) => (handErr ? reject(handErr) : resolve())
                      );
                    });
                  });
  
                  Promise.all(handPromises)
                    .then(() => {
                      const talonJSON = JSON.stringify(talon);
                      db.query(
                        "UPDATE rounds SET talon_cards = ? WHERE id = ?",
                        [talonJSON, roundId],
                        (talonErr) => {
                          if (talonErr) {
                            console.error("Error updating talon cards:", talonErr);
                            return res
                              .status(500)
                              .json({ error: "Database error." });
                          }
  
                          const initialPlayerId = playerOrder[0];
                          io.to(`game_${gameId}`).emit("newRound", {
                            roundId,
                            playerOrder,
                          });
                          io.to(`game_${gameId}`).emit("nextTurn", {
                            nextPlayerId: initialPlayerId,
                          });
  
                          console.log(
                            `New round ${roundId} created. Cards dealt.`
                          );
                          res.status(201).json({
                            message: "New round successfully created.",
                            roundId,
                            licitacija: licitacijaData,
                            nextPlayerId: initialPlayerId,
                          });
                        }
                      );
                    })
                    .catch((errAll) => {
                      console.error("Error assigning hands to players:", errAll);
                      res.status(500).json({ error: "Error assigning hands." });
                    });
                }
              );
            }
          );
        } else {
          // Existing round is not finished
          const existingRound = results[0];
          return res.status(200).json({
            roundId: existingRound.id,
            licitacija: JSON.parse(existingRound.licitacija),
            message: "Round already exists and is not finished.",
          });
        }
      }
    );
  });
  
  
  
  
  
  
  
  

  
  
  function generateDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck = [];
  
    for (const suit of suits) {
      for (const value of values) {
        deck.push({
          suit,
          value,
          image: `/Slike/${value}_${
            suit === '♠' ? 'spades'
            : suit === '♥' ? 'hearts'
            : suit === '♦' ? 'diamonds'
            : 'clubs'
          }.png`
        });
      }
    }
  
    // Shuffle using Fisher-Yates
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  
    return deck;
  }
  
  
  
  // [2] /api/rounds/:gameId/deal
// Generiše špil i podeli karte igračima u bazi
router.post('/:gameId/deal', (req, res) => {
  const { gameId } = req.params;

  // Dohvati trenutni round_id za igru
  db.query(
    'SELECT id, talon_cards FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 1',
    [gameId],
    (err, results) => {
      if (err) {
        console.error('Greška pri dohvatanju runde:', err);
        return res.status(500).json({ error: 'Greška u bazi podataka.' });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: 'Runda nije pronađena.' });
      }

      const round = results[0];
      const roundId = round.id;

      // Proveri da li su karte već podeljene
      if (round.talon_cards) {
        return res.status(400).json({ error: 'Karte su već podeljene za ovu rundu.' });
      }

      // Generisanje špila i deljenje karata
      const deck = generateDeck();
      const playerHands = [deck.slice(0, 10), deck.slice(10, 20), deck.slice(20, 30)];
      const talon = deck.slice(30, 32);

      db.query(
        'SELECT id, user_id FROM game_players WHERE game_id = ? ORDER BY id ASC',
        [gameId],
        (playerErr, players) => {
          if (playerErr) {
            console.error('Greška pri dohvatanju igrača:', playerErr);
            return res.status(500).json({ error: 'Greška u bazi podataka.' });
          }

          // Ažuriraj ruke i round_id za igrače
          const updates = players.map((player, index) => {
            const hand = JSON.stringify(playerHands[index]);
            return new Promise((resolve, reject) => {
              db.query(
                'UPDATE game_players SET hand = ?, round_id = ? WHERE id = ?',
                [hand, roundId, player.id],
                (err) => (err ? reject(err) : resolve())
              );
            });
          });

          // Ažuriraj talon i emituj događaj
          Promise.all(updates)
            .then(() => {
              const talonJSON = JSON.stringify(talon);
              db.query(
                'UPDATE rounds SET talon_cards = ? WHERE id = ?',
                [talonJSON, roundId],
                (updateErr) => {
                  if (updateErr) {
                    console.error('Greška pri ažuriranju talona:', updateErr);
                    return res.status(500).json({ error: 'Greška u bazi podataka.' });
                  }

                  // Emit licitacijaUpdated događaj
                  db.query(
                    'SELECT licitacija FROM rounds WHERE id = ?',
                    [roundId],
                    (licitacijaErr, licitacijaResults) => {
                      if (licitacijaErr) {
                        console.error('Greška pri dohvatanju licitacije:', licitacijaErr);
                        return;
                      }

                      const licitacija = licitacijaResults[0]?.licitacija
                        ? JSON.parse(licitacijaResults[0].licitacija)
                        : null;

                      io.to(`game_${gameId}`).emit('licitacijaUpdated', licitacija);

                      console.log('Karte podeljene i licitacija ažurirana.');
                      res.status(200).json({ message: 'Karte podeljene.', talon });
                    }
                  );
                }
              );
            })
            .catch((updateErr) => {
              console.error('Greška pri ažuriranju ruku igrača:', updateErr);
              res.status(500).json({ error: 'Greška u bazi podataka.' });
            });
        }
      );
    }
  );
});


//postavljanje aduta  za rundu
router.post('/:gameId/set-trump', (req, res) => {
  const { gameId } = req.params;
  const { adut } = req.body;

  if (!adut) {
    return res.status(400).json({ error: 'Adut nije prosleđen.' });
  }

  db.query(
    'UPDATE rounds SET adut = ? WHERE game_id = ? ORDER BY id DESC LIMIT 1',
    [adut, gameId],
    (err) => {
      if (err) {
        console.error('Greška pri ažuriranju aduta:', err);
        return res.status(500).json({ error: 'Greška u bazi podataka.' });
      }

      // Emituj ažuriran adut svim igračima
      io.to(`game_${gameId}`).emit('trumpUpdated', adut);

      console.log(`Adut postavljen: ${adut}`);
      res.status(200).json({ message: 'Adut uspešno postavljen.', adut });
    }
  );
  
  // Emituj događaj nextPlayer posle aduta
  db.query(
    "SELECT player_order FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 1",
    [gameId],
    (err, results) => {
      if (err || results.length === 0) {
        console.error("Greška pri dohvatanju player_order:", err);
        return;
      }
      const playerOrder = JSON.parse(results[0].player_order);
      const nextPlayerId = playerOrder[0]; // Početni igrač
  
      io.to(`game_${gameId}`).emit("nextPlayer", { nextPlayerId });
      console.log(`Postavljen prvi igrač nakon aduta: ${nextPlayerId}`);
    }
  );
  
});

//osvezavanje ruke nakon talona
router.post('/:gameId/update-hand', (req, res) => {
  const { gameId } = req.params;
  const { userId, newHand } = req.body;

  if (!userId || !newHand || !Array.isArray(newHand)) {
    return res.status(400).json({ error: 'Nevalidni podaci.' });
  }

  const handJSON = JSON.stringify(newHand);

  db.query(
    'UPDATE game_players SET hand = ? WHERE game_id = ? AND user_id = ?',
    [handJSON, gameId, userId],
    (err) => {
      if (err) {
        console.error('Greška pri ažuriranju ruke igrača:', err);
        return res.status(500).json({ error: 'Greška u bazi podataka.' });
      }

      console.log(`Ruka igrača ${userId} ažurirana u igri ${gameId}.`);

      // Emituje događaj svim klijentima u igri
      io.to(`game_${gameId}`).emit('handUpdated', { userId, newHand });

      io.to(`game_${gameId}`).emit('hideTalon');

      res.status(200).json({ message: 'Ruka uspešno ažurirana.' });
    }
  );
});

//ruta za pokretanje nove runde nakon bacanja 10 karata
router.post("/:gameId/newRound", (req, res) => {
  const { gameId } = req.params;

  // Proveravamo da li su svi igrači ostali bez karata
  db.query(
    "SELECT hand FROM game_players WHERE game_id = ?",
    [gameId],
    (err, results) => {
      if (err) {
        console.error("Greška pri dohvatanju ruku igrača:", err);
        return res.status(500).json({ error: "Greška u bazi podataka." });
      }

      const handsEmpty = results.every((p) => {
        const handArr = JSON.parse(p.hand || "[]");
        return handArr.length === 0;
      });

      if (!handsEmpty) {
        return res.status(400).json({
          message: "Još ima karata u rukama. Ne možemo startovati novu rundu.",
        });
      }

      // Dohvati prethodnu rundu i nasledi player_order
      db.query(
        "SELECT player_order FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 1",
        [gameId],
        (roundErr, roundRows) => {
          if (roundErr) {
            console.error("Greška pri dohvatanju prethodne runde:", roundErr);
            return res.status(500).json({ error: "Greška u bazi." });
          }

          const playerOrder =
            roundRows.length > 0 && roundRows[0].player_order
              ? roundRows[0].player_order
              : "[]";

          const novaLicitacija = {
            playerOrder: JSON.parse(playerOrder),
            currentPlayerIndex: 0,
            bids: [],
            minBid: 5,
            passedPlayers: [],
            finished: false,
          };

          // Kreiraj novu rundu sa resetovanjem aduta i licitacije
          db.query(
            "INSERT INTO rounds (game_id, player_order, licitacija, adut) VALUES (?, ?, ?, NULL)",
            [gameId, playerOrder, JSON.stringify(novaLicitacija)],
            (insertErr, insertResult) => {
              if (insertErr) {
                console.error("Greška pri kreiranju nove runde:", insertErr);
                return res
                  .status(500)
                  .json({ error: "Greška pri kreiranju nove runde." });
              }

              const newRoundId = insertResult.insertId;

              // Ažuriraj igrače sa novim round_id i isprazni im ruke
              db.query(
                "UPDATE game_players SET round_id = ?, hand = '[]' WHERE game_id = ?",
                [newRoundId, gameId],
                (updateErr) => {
                  if (updateErr) {
                    console.error("Greška pri update-u igrača:", updateErr);
                    return res
                      .status(500)
                      .json({ error: "Greška pri ažuriranju igrača." });
                  }

                  // Generisanje novog špila i podela karata
                  const deck = generateDeck();
                  const playerHands = [
                    deck.slice(0, 10),
                    deck.slice(10, 20),
                    deck.slice(20, 30),
                  ];
                  const talon = deck.slice(30, 32);

                  db.query(
                    "SELECT id FROM game_players WHERE game_id = ? ORDER BY id ASC",
                    [gameId],
                    (playerErr, players) => {
                      if (playerErr) {
                        console.error(
                          "Greška pri dohvatanju liste igrača:",
                          playerErr
                        );
                        return res
                          .status(500)
                          .json({ error: "Greška u bazi podataka." });
                      }

                      const updates = players.map((player, index) => {
                        return new Promise((resolve, reject) => {
                          const handJSON = JSON.stringify(
                            playerHands[index] || []
                          );
                          db.query(
                            "UPDATE game_players SET hand = ? WHERE id = ?",
                            [handJSON, player.id],
                            (updateHandErr) => {
                              if (updateHandErr) reject(updateHandErr);
                              else resolve();
                            }
                          );
                        });
                      });

                      Promise.all(updates)
                        .then(() => {
                          const talonJSON = JSON.stringify(talon);
                          db.query(
                            "UPDATE rounds SET talon_cards = ? WHERE id = ?",
                            [talonJSON, newRoundId],
                            (talonErr) => {
                              if (talonErr) {
                                console.error(
                                  "Greška pri ažuriranju talona:",
                                  talonErr
                                );
                                return res
                                  .status(500)
                                  .json({ error: "Greška u bazi podataka." });
                              }

                              console.log(
                                `Nova runda ${newRoundId} je spremna.`
                              );

                              io.to(`game_${gameId}`).emit("newRound", {
                                roundId: newRoundId,
                                playerOrder: novaLicitacija.playerOrder,
                              });
                              
                              return res.status(200).json({
                                message: "Nova runda je započeta.",
                                roundId: newRoundId,
                              });
                            }
                          );
                        })
                        .catch((updateHandErr) => {
                          console.error(
                            "Greška pri ažuriranju ruku igrača:",
                            updateHandErr
                          );
                          return res
                            .status(500)
                            .json({ error: "Greška pri ažuriranju ruku." });
                        });
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
});


  return router;
};
