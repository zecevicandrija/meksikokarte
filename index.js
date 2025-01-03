// index.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const db = require('./db'); // Konekcija sa MySQL bazom

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: 'http://localhost:3000', // Dozvoljena React aplikacija
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Rute za igre i igrače
const gameRoutes = require('./routes/games');
app.use('/api/games', gameRoutes);
app.use('/api', gameRoutes);

const gamePlayersRoutes = require('./routes/gamePlayers');
app.use('/api/game-players', gamePlayersRoutes);

const roundsRoutes = require('./routes/rounds');
app.use('/api/rounds', roundsRoutes);

const authRouter = require('./routes/auth');
const korisniciRouter = require('./routes/korisnici');
app.use('/api/auth', authRouter);
app.use('/api/korisnici', korisniciRouter);

// --- Funkcija za generisanje špila od 32 karte
function generateDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck = [];
  for (const suit of suits) {
    for (const value of values) {
      deck.push({ suit, value });
    }
  }
  // Promešaj
  deck.sort(() => Math.random() - 0.5);
  return deck;
}

// --- Funkcija koja podeli karte u bazi, ako ima 3 igrača
function dealCardsToGame(gameId) {
  return new Promise((resolve, reject) => {
    const deck = generateDeck();

    // Izdvoji karte (10, 10, 10), + 2 za talon
    const playerHands = [
      deck.slice(0, 10),
      deck.slice(10, 20),
      deck.slice(20, 30),
    ];
    const talon = deck.slice(30, 32);

    // Dohvati sve igrače za dati gameId
    db.query(
      'SELECT id FROM game_players WHERE game_id = ? ORDER BY id ASC', 
      [gameId], 
      (err, players) => {
        if (err) return reject(err);
        if (players.length < 3) {
          return reject('Nema 3 igrača u igri. Ne mogu podeliti karte.');
        }

        // Za svakog igrača, upiši 'hand' JSON u game_players
        const queries = players.map((player, index) => {
          const handJson = JSON.stringify(playerHands[index] || []);
          return new Promise((res, rej) => {
            db.query(
              'UPDATE game_players SET hand = ? WHERE id = ?',
              [handJson, player.id],
              (updErr) => (updErr ? rej(updErr) : res())
            );
          });
        });

        // Kad se svi upisi završe, upišemo i talon u games
        Promise.all(queries)
          .then(() => {
            db.query(
              'UPDATE games SET talon_cards = ? WHERE id = ?',
              [JSON.stringify(talon), gameId],
              (talonErr) => {
                if (talonErr) return reject(talonErr);
                resolve(); // Sve gotovo
              }
            );
          })
          .catch(reject);
      }
    );
  });
}

// Socket.IO logika
io.on('connection', (socket) => {
  console.log(`Korisnik povezan: ${socket.id}`);

  // Pridruživanje sobi igre
  socket.on('joinGame', ({ gameId, userId }) => {
    if (!gameId || !userId) {
      console.error('Nedostaju podaci: gameId ili userId');
      return;
    }

    socket.join(`game_${gameId}`);
    console.log(`Korisnik ${userId} se pridružio igri ${gameId}`);

    // Proveri da li igrač već postoji u bazi
    db.query(
      'SELECT * FROM game_players WHERE game_id = ? AND user_id = ?',
      [gameId, userId],
      (err, results) => {
        if (err) {
          console.error('Greška pri SELECT-u game_players:', err);
          return;
        }

        if (results.length === 0) {
          // Insert novog igrača
          db.query(
            'INSERT INTO game_players (game_id, user_id, score) VALUES (?, ?, ?)',
            [gameId, userId, 0],
            (insertErr) => {
              if (insertErr) {
                console.error('Greška prilikom dodavanja igrača:', insertErr);
              } else {
                console.log(`Igrač ${userId} dodat u igru ${gameId}`);
                io.to(`game_${gameId}`).emit('playerJoined', { userId });
                // Sada proveravamo koliko ima igrača ukupno
                checkAndDealIf3Players(gameId);
              }
            }
          );
        } else {
          console.log(`Igrač ${userId} već postoji u igri ${gameId}`);
          // Takođe proveravamo da li je sada 3
          checkAndDealIf3Players(gameId);
        }
      }
    );
  });

  // Primer funkcije koji proveri broj igrača i, ako je 3, podeli
  function checkAndDealIf3Players(gameId) {
    db.query(
      'SELECT COUNT(*) AS cnt FROM game_players WHERE game_id = ?',
      [gameId],
      (err, results) => {
        if (err) {
          console.error('Greška prilikom brojanja igrača:', err);
          return;
        }
        const playerCount = results[0].cnt;
        if (playerCount === 3) {
          console.log(`Igra ${gameId} sada ima 3 igrača. Delim karte...`);
          dealCardsToGame(gameId)
            .then(() => {
              console.log('Karte uspešno podeljene.');
              // Emitujemo svim klijentima da su karte podeljene
              io.to(`game_${gameId}`).emit('cardsDealt', {
                message: 'Karte su podeljene (automatski).'
              });
            })
            .catch((errDeal) => {
              console.error('Greška prilikom deljenja karata:', errDeal);
            });
        }
      }
    );
  }

  // Ostale socket.on evente (npr. playCard, itd.) ako ti trebaju
  socket.on('playCard', ({ gameId, userId, card }) => {
    // ...
  });

  // Kada se korisnik odvoji
  socket.on('disconnect', () => {
    console.log(`Korisnik odvojen: ${socket.id}`);
  });
});

// Pokretanje servera
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server pokrenut na portu ${PORT}`);
});
