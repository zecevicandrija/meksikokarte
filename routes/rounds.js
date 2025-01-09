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
  router.post('/:gameId/start-round', (req, res) => {
    const { gameId } = req.params;
  
    db.query(
      'SELECT * FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 1',
      [gameId],
      (err, results) => {
        if (err) {
          console.error('Greška pri dohvatanju aktivne runde:', err);
          return res.status(500).json({ error: 'Greška u bazi podataka.' });
        }
  
        if (results.length > 0) {
          // Ako runda već postoji, vrati njeno stanje
          const existingRound = results[0];
          return res.status(200).json({
            roundId: existingRound.id,
            licitacija: existingRound.licitacija
              ? JSON.parse(existingRound.licitacija)
              : null,
            message: 'Runda već postoji.',
          });
        }
  
        // Proveri broj igrača
        db.query(
          'SELECT user_id FROM game_players WHERE game_id = ?',
          [gameId],
          (playerErr, players) => {
            if (playerErr) {
              console.error('Greška pri dohvatanju igrača:', playerErr);
              return res.status(500).json({ error: 'Greška u bazi podataka.' });
            }
  
            if (players.length < 3) {
              return res.status(200).json({
                message: 'Čeka se još igrača.',
                players: players.length,
              });
            }
  
            // Kreiraj novu rundu
            const playerOrder = players.map((p) => p.user_id); // Redosled igrača
            const licitacijaData = {
              playerOrder,
              currentPlayerIndex: 0,
              bids: Array(playerOrder.length).fill(null),
              minBid: 5,
              passedPlayers: [],
              finished: false,
            };
  
            db.query(
              'INSERT INTO rounds (game_id, licitacija, player_order) VALUES (?, ?, ?)',
              [gameId, JSON.stringify(licitacijaData), JSON.stringify(playerOrder)],
              (insertErr, result) => {
                if (insertErr) {
                  console.error('Greška pri kreiranju runde:', insertErr);
                  return res.status(500).json({ error: 'Greška u bazi podataka.' });
                }
  
                const roundId = result.insertId;
  
                // Emitujemo ažuriranu licitaciju svim igračima
                io.to(`game_${gameId}`).emit('licitacijaUpdated', licitacijaData);
  
                console.log(`Runda kreirana: roundId=${roundId}, playerOrder=${playerOrder}`);
                res.status(201).json({ roundId, licitacija: licitacijaData });
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

  db.query(
    'SELECT talon_cards FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 1',
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

      // Proveri da li su karte već podeljene
      if (round.talon_cards) {
        return res.status(400).json({ error: 'Karte su već podeljene za ovu rundu.' });
      }

      // Generisanje i deljenje karata (postojeći kod)
      const deck = generateDeck();
      const playerHands = [deck.slice(0, 10), deck.slice(10, 20), deck.slice(20, 30)];
      const talon = deck.slice(30, 32);

      db.query(
        'SELECT id FROM game_players WHERE game_id = ? ORDER BY id ASC',
        [gameId],
        (playerErr, players) => {
          if (playerErr) {
            console.error('Greška pri dohvatanju igrača:', playerErr);
            return res.status(500).json({ error: 'Greška u bazi podataka.' });
          }

          const updates = players.map((player, index) => {
            const hand = JSON.stringify(playerHands[index]);
            return new Promise((resolve, reject) => {
              db.query(
                'UPDATE game_players SET hand = ? WHERE id = ?',
                [hand, player.id],
                (err) => (err ? reject(err) : resolve())
              );
            });
          });

          Promise.all(updates)
            .then(() => {
              const talonJSON = JSON.stringify(talon);
              db.query(
                'UPDATE rounds SET talon_cards = ? WHERE game_id = ? ORDER BY id DESC LIMIT 1',
                [talonJSON, gameId],
                (updateErr) => {
                  if (updateErr) {
                    console.error('Greška pri ažuriranju talona:', updateErr);
                    return res.status(500).json({ error: 'Greška u bazi podataka.' });
                  }

                  // Emit licitacijaUpdated
                  db.query(
                    'SELECT licitacija FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 1',
                    [gameId],
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




  return router;
};
