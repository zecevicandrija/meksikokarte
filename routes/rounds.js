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
  
    // 1) Proveri da li već postoji runda
    db.query(
      "SELECT * FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 1",
      [gameId],
      (err, results) => {
        if (err) {
          console.error("Greška pri dohvatanju aktivne runde:", err);
          return res.status(500).json({ error: "Greška u bazi podataka." });
        }
  
        // Ako već postoji neka runda, samo je vrati
        if (results.length > 0) {
          const existingRound = results[0];
          return res.status(200).json({
            roundId: existingRound.id,
            licitacija: existingRound.licitacija
              ? JSON.parse(existingRound.licitacija)
              : null,
            message: "Runda već postoji.",
          });
        }
  
        // 2) Dohvati sve igrače
        db.query(
          "SELECT user_id FROM game_players WHERE game_id = ?",
          [gameId],
          (playerErr, players) => {
            if (playerErr) {
              console.error("Greška pri dohvatanju igrača:", playerErr);
              return res.status(500).json({ error: "Greška u bazi podataka." });
            }
  
            if (players.length < 3) {
              return res.status(200).json({
                message: "Čeka se još igrača.",
                players: players.length,
              });
            }
  
            // 3) Napravi playerOrder i licitaciju
            const playerOrder = players.map((p) => p.user_id);
            const licitacijaData = {
              playerOrder,
              currentPlayerIndex: 0,
              bids: Array(playerOrder.length).fill(null),
              minBid: 5,
              passedPlayers: [],
              finished: false,
            };
  
            // 4) Kreiraj rundu
            db.query(
              "INSERT INTO rounds (game_id, player_order, licitacija) VALUES (?, ?, ?)",
              [gameId, JSON.stringify(playerOrder), JSON.stringify(licitacijaData)],
              (insertErr, result) => {
                if (insertErr) {
                  console.error("Greška pri kreiranju runde:", insertErr);
                  return res
                    .status(500)
                    .json({ error: "Greška u bazi podataka." });
                }
  
                const roundId = result.insertId;
  
                // 5) Ažuriraj round_id svim igračima
                db.query(
                  "UPDATE game_players SET round_id = ? WHERE game_id = ?",
                  [roundId, gameId],
                  (updateErr) => {
                    if (updateErr) {
                      console.error(
                        "Greška pri ažuriranju round_id za igrače:",
                        updateErr
                      );
                      return res
                        .status(500)
                        .json({ error: "Greška u bazi podataka." });
                    }
  
                    console.log(
                      `Runda kreirana (id=${roundId}), poredak: ${playerOrder}`
                    );
  
                    // Emituj ažuriranu licitaciju
                    io.to(`game_${gameId}`).emit("licitacijaUpdated", licitacijaData);
  
                    // ---------------------------------------
                    // 6) Deljenje karata
                    // ---------------------------------------
                    const deck = generateDeck();
                    const playerHands = [
                      deck.slice(0, 10),
                      deck.slice(10, 20),
                      deck.slice(20, 30),
                    ];
                    const talon = deck.slice(30, 32);
  
                    db.query(
                      "SELECT id, user_id FROM game_players WHERE game_id = ? ORDER BY id ASC",
                      [gameId],
                      (gErr, gpRows) => {
                        if (gErr) {
                          console.error(
                            "Greška pri dohvatanju liste igrača:",
                            gErr
                          );
                          return res
                            .status(500)
                            .json({ error: "Greška u bazi podataka." });
                        }
  
                        const promises = gpRows.map((player, index) => {
                          const handJSON = JSON.stringify(playerHands[index] || []);
                          return new Promise((resolve, reject) => {
                            db.query(
                              "UPDATE game_players SET hand = ? WHERE id = ?",
                              [handJSON, player.id],
                              (uErr) => (uErr ? reject(uErr) : resolve())
                            );
                          });
                        });
  
                        Promise.all(promises)
                          .then(() => {
                            const talonJSON = JSON.stringify(talon);
                            db.query(
                              "UPDATE rounds SET talon_cards = ? WHERE id = ?",
                              [talonJSON, roundId],
                              (talErr) => {
                                if (talErr) {
                                  console.error(
                                    "Greška pri ažuriranju talona:",
                                    talErr
                                  );
                                  return res
                                    .status(500)
                                    .json({ error: "Greška u bazi podataka." });
                                }
  
                                // Emituj događaj za postavljanje trenutnog igrača
                                const initialPlayerId = playerOrder[0];
                                io.to(`game_${gameId}`).emit("nextTurn", {
                                  nextPlayerId: initialPlayerId,
                                });
  
                                console.log(
                                  `Karte podeljene! Talon je upisan za rundu ${roundId}.`
                                );
                                return res.status(201).json({
                                  message:
                                    "Nova runda uspešno kreirana i karte podeljene.",
                                  roundId,
                                  licitacija: licitacijaData,
                                  nextPlayerId: initialPlayerId,
                                });
                              }
                            );
                          })
                          .catch((errAll) => {
                            console.error(
                              "Greška pri ažuriranju ruku igrača:",
                              errAll
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
router.post('/:gameId/newRound', (req, res) => {
  const { gameId } = req.params;

  // 1) Proveravamo da li su svi igrači ostali bez karata
  db.query(
    'SELECT hand FROM game_players WHERE game_id = ?',
    [gameId],
    (err, results) => {
      if (err) {
        console.error('Greška pri dohvatanju ruku igrača:', err);
        return res.status(500).json({ error: 'Greška u bazi podataka.' });
      }

      const handsEmpty = results.every((p) => {
        const handArr = JSON.parse(p.hand || '[]');
        return handArr.length === 0;
      });

      if (!handsEmpty) {
        return res.status(400).json({
          message: 'Još ima karata u rukama. Ne možemo startovati novu rundu.',
        });
      }

      // 2) Dohvati poslednju rundu i nasledi samo player_order
      db.query(
        'SELECT player_order FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 1',
        [gameId],
        (roundErr, roundRows) => {
          if (roundErr) {
            console.error('Greška pri dohvatanju prethodne runde:', roundErr);
            return res.status(500).json({ error: 'Greška u bazi.' });
          }

          let playerOrder = '[]'; // default ako nema stare runde
          if (roundRows.length > 0 && roundRows[0].player_order) {
            playerOrder = roundRows[0].player_order; // npr. '["1","2","3"]'
          }

          // 3) Kreiramo novu licitaciju (praznu, tj. na početne vrednosti):
          const novaLicitacija = {
            playerOrder: JSON.parse(playerOrder),
            currentPlayerIndex: 0,
            bids: [],
            minBid: 5,
            passedPlayers: [],
            finished: false,
          };

          // 4) Kreiraj novi red u rounds
          // OVDE eksplicitno setujemo adut = NULL, 
          //   ili posle radimo UPDATE rounds SET adut=NULL ...
          db.query(
            'INSERT INTO rounds (game_id, player_order, licitacija, adut) VALUES (?, ?, ?, NULL)',
            [
              gameId,
              playerOrder,
              JSON.stringify(novaLicitacija),
            ],
            (insertErr, insertResult) => {
              if (insertErr) {
                console.error('Greška pri kreiranju nove runde:', insertErr);
                return res
                  .status(500)
                  .json({ error: 'Greška pri kreiranju nove runde.' });
              }

              const newRoundId = insertResult.insertId;
              console.log(`Nova runda je kreirana, round_id = ${newRoundId}`);

              // 5) Poveži sve igrače na newRoundId i (po želji) isprazni im hand
              db.query(
                "UPDATE game_players SET round_id = ?, hand = '[]' WHERE game_id = ?",
                [newRoundId, gameId],
                (updateErr) => {
                  if (updateErr) {
                    console.error('Greška pri update-u igrača:', updateErr);
                    return res
                      .status(500)
                      .json({ error: 'Greška pri ažuriranju igrača.' });
                  }

                  // 6) Generišemo špil i delimo karte
                  const deck = generateDeck(); // Vaša funkcija
                  const playerHands = [
                    deck.slice(0, 10),
                    deck.slice(10, 20),
                    deck.slice(20, 30),
                  ];
                  const talon = deck.slice(30, 32);

                  // Dohvati sve igrače
                  db.query(
                    'SELECT id FROM game_players WHERE game_id = ? ORDER BY id ASC',
                    [gameId],
                    (pErr, players) => {
                      if (pErr) {
                        console.error('Greška pri dohvatanju liste igrača:', pErr);
                        return res
                          .status(500)
                          .json({ error: 'Greška u bazi.' });
                      }

                      if (players.length < 3) {
                        return res
                          .status(400)
                          .json({ error: 'Nema dovoljno igrača.' });
                      }

                      // 7) Svim igračima postavljamo hand
                      const updates = players.map((player, index) => {
                        return new Promise((resolve, reject) => {
                          const handJSON = JSON.stringify(
                            playerHands[index] || []
                          );
                          db.query(
                            'UPDATE game_players SET hand = ? WHERE id = ?',
                            [handJSON, player.id],
                            (uErr) => {
                              if (uErr) reject(uErr);
                              else resolve();
                            }
                          );
                        });
                      });

                      Promise.all(updates)
                        .then(() => {
                          // 8) Upis talona u rounds
                          const talonJSON = JSON.stringify(talon);
                          db.query(
                            'UPDATE rounds SET talon_cards = ? WHERE id = ?',
                            [talonJSON, newRoundId],
                            (talErr) => {
                              if (talErr) {
                                console.error(
                                  'Greška pri ažuriranju talona:',
                                  talErr
                                );
                                return res
                                  .status(500)
                                  .json({ error: 'Greška u bazi.' });
                              }

                              // Uspeh: nova runda + sveže karte + resetovan adut
                              console.log(
                                `Nova runda ${newRoundId} je spremna, karte podeljene i talon postavljen.`
                              );
                              return res.status(200).json({
                                message: 'Nova runda je započeta.',
                                roundId: newRoundId,
                              });
                            }
                          );
                        })
                        .catch((errorAll) => {
                          console.error(
                            'Greška pri update-u ruku igrača:',
                            errorAll
                          );
                          return res
                            .status(500)
                            .json({ error: 'Nismo uspeli da podelimo karte.' });
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
