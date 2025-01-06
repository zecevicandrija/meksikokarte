// index.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const db = require('./db'); // Tvoj fajl za MySQL konekciju

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: 'http://localhost:3000', // Adresa front-enda (React)
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// --------------------
// Učitavanje ruta
const gameRoutes = require('./routes/games');
app.use('/api/games', gameRoutes);
app.use('/api', gameRoutes);

const gamePlayersRoutes = require('./routes/gamePlayers');
app.use('/api/game-players', gamePlayersRoutes);

// Ova linija je bitna: roundsRoutes sada poziva funkciju i prosleđuje `io`
// (umesto direktnog `require('./routes/rounds')`)
const roundsRoutes = require('./routes/rounds')(io);
app.use('/api/rounds', roundsRoutes);

const authRouter = require('./routes/auth');
const korisniciRouter = require('./routes/korisnici');
app.use('/api/auth', authRouter);
app.use('/api/korisnici', korisniciRouter);

// --------------------
// Pomoćne funkcije (za deljenje karata, sortiranje, itd.)

// 1) Generisanje i sortiranje špila (32 karte)
function sortDeck(deck) {
  const suitOrder = ['♠', '♥', '♦', '♣'];
  const valueOrder = ['A', 'K', 'Q', 'J', '10', '9', '8', '7'];
  
  return deck.sort((a, b) => {
    const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
    if (suitDiff !== 0) return suitDiff;
    return valueOrder.indexOf(a.value) - valueOrder.indexOf(b.value);
  });
}

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
  return deck.sort(() => Math.random() - 0.5);
}

// 2) Deljenje karata kada ima 3 igrača
function dealCardsToGame(gameId) {
  return new Promise((resolve, reject) => {
    const deck = generateDeck();
    const playerHands = [
      deck.slice(0, 10),
      deck.slice(10, 20),
      deck.slice(20, 30),
    ].map(hand => sortDeck(hand));

    const talon = deck.slice(30, 32);

    db.query(
      'SELECT id FROM game_players WHERE game_id = ? ORDER BY id ASC',
      [gameId],
      (err, players) => {
        if (err) return reject(err);
        if (players.length < 3) {
          return reject('Nema 3 igrača u igri. Ne mogu podeliti karte.');
        }

        // Upis ruku u bazu
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

        Promise.all(queries)
          
          .catch(reject);
      }
    );
  });
}

// 3) Funkcija da dobijemo "trenutnu" rundu (poslednju) iz tabele "rounds" za datu igru
function getActiveRoundForGame(gameId, callback) {
  db.query(
    'SELECT * FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 1',
    [gameId],
    (err, results) => {
      if (err) return callback(err);
      if (results.length === 0) return callback(null, null); // nema runde
      callback(null, results[0]);
    }
  );
}

// 4) Funkcija za ažuriranje polja "licitacija" u rounds
function updateRoundLicitacija(roundId, newLicData, callback) {
  const jsonLic = JSON.stringify(newLicData);
  db.query(
    'UPDATE rounds SET licitacija = ? WHERE id = ?',
    [jsonLic, roundId],
    (err) => {
      callback(err);
    }
  );
}

// --------------------
// Socket.IO logika
io.on('connection', (socket) => {
  console.log(`Korisnik povezan: ${socket.id}`);

  // 1) Event: joinGame => igrač se pridružuje sobi "game_{gameId}"
  socket.on('joinGame', ({ gameId, userId }) => {
    if (!gameId || !userId) {
      console.error('Nedostaju podaci: gameId ili userId');
      return;
    }
    socket.join(`game_${gameId}`);
    console.log(`Korisnik ${userId} se pridružio igri ${gameId}`);

    // Proveri da li već postoji slog u game_players
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
                checkAndDealIf3Players(gameId);
              }
            }
          );
        } else {
          console.log(`Igrač ${userId} već postoji u igri ${gameId}`);
          checkAndDealIf3Players(gameId);
        }
      }
    );
  });

  // Ako u igri ima 3 igrača => podeli karte
  function checkAndDealIf3Players(gameId) {
    db.query('SELECT COUNT(*) AS cnt FROM game_players WHERE game_id = ?', [gameId], (err, results) => {
      if (err) {
        console.error('Greška prilikom brojanja igrača:', err);
        return;
      }
      const playerCount = results[0].cnt;
      if (playerCount === 3) {
        console.log(`Igra ${gameId} sada ima 3 igrača. Delim karte...`);
  
        // Samo emituj allPlayersJoined, BEZ then/catch
        io.to(`game_${gameId}`).emit('allPlayersJoined');
  
        // Ako želiš da odmah podeliš karte na serverskoj strani:
        // dealCardsToGame(gameId)  // (ako uopšte treba)
        //
        // Ili samo pošalji “allPlayersJoined” klijentu,
        // pa neka klijent pozove POST /api/rounds/:gameId/deal
        // ili nešto slično.
      }
    });
  }
  

  // 2) Event: playerBid => licitacija
  socket.on('playerBid', ({ roundId, userId, bid }) => {
    // Ako front šalje "roundId" kao gameId:
    const gameId = roundId;

    getActiveRoundForGame(gameId, (err, round) => {
      if (err) {
        console.error('Greška pri dohvatu runde:', err);
        return;
      }
      if (!round) {
        console.warn(`Nema aktivne runde za igru ${gameId}`);
        return;
      }

      let licData = null;
      try {
        licData = round.licitacija ? JSON.parse(round.licitacija) : null;
      } catch (parseErr) {
        console.error('Ne mogu da parse-ujem licitacija JSON:', parseErr);
        return;
      }
      if (!licData) {
        console.warn('Nema licitacija podataka u rounds.licitacija');
        return;
      }

      // Raspakujemo podatke iz licData
      const {
        playerOrder = [],
        currentPlayerIndex = 0,
        bids = [],
        passedPlayers = [],
        minBid = 5
      } = licData;

      const currentPlayerId = playerOrder[currentPlayerIndex] || null;
      if (!currentPlayerId) {
        console.warn('Nema currentPlayerId u licData');
        return;
      }

      // Provera da li je userId == currentPlayerId
      if (currentPlayerId !== userId) {
        console.log(`Igrac ${userId} nije na potezu. Trenutni je ${currentPlayerId}.`);
        return; // ignorisi
      }

      // Ako su vec 2 igrača rekli "Dalje", 3. ne može reći "Dalje"
      if (passedPlayers.length === 2 && bid === 'Dalje') {
        console.log('Treći igrač ne može reći Dalje ako su već dvojica rekla Dalje!');
        return;
      }

      // Obrada licitacije
      let newMinBid = minBid;
      if (bid === 'Dalje') {
        if (!passedPlayers.includes(userId)) {
          passedPlayers.push(userId);
        }
      } else {
        // Ako je "Meksiko" => 11
        let numericBid = (bid === 'Meksiko') ? 11 : parseInt(bid, 10) || 5;
        if (numericBid < minBid) {
          console.log(`Bid ${numericBid} < minBid ${minBid}. Nevalidno.`);
          return;
        }
        bids[currentPlayerIndex] = numericBid;
        newMinBid = numericBid + 1;
      }
      
      // DODATO: Provera koliko je aktivnih igrača
      const allPlayers = playerOrder;
      const activePlayers = allPlayers.filter(pid => !passedPlayers.includes(pid));
      
      // Ako je ostao 0 ili 1 aktivan igrač => licitacija gotova
      if (activePlayers.length <= 1) {
        licData.finished = true;
        if (activePlayers.length === 1) {
          licData.winnerId = activePlayers[0];
        } else {
          licData.winnerId = null; // svi pass
        }
      }
      
      // DODATO: Ako licitacija nije gotova, prelazimo na sledećeg
      if (!licData.finished) {
        let nextIndex = currentPlayerIndex;
        let attempts = 0;
        const maxPlayers = allPlayers.length;
      
        // Petlja da nađemo sledećeg koji NIJE u passedPlayers
        do {
          nextIndex = (nextIndex + 1) % maxPlayers;
          attempts++;
        } while (
          passedPlayers.includes(allPlayers[nextIndex]) &&
          attempts < maxPlayers
        );
      
        if (attempts >= maxPlayers) {
          // Svi su passovali
          licData.finished = true;
        } else {
          licData.currentPlayerIndex = nextIndex;
        }
      }
      // let nextIndex = currentPlayerIndex + 1;
      // if (nextIndex >= playerOrder.length) {
      //   nextIndex = 0;
      // }

      // licData.currentPlayerIndex = nextIndex;
      licData.minBid = newMinBid;
      licData.bids = bids;
      licData.passedPlayers = passedPlayers;
      licData.playerOrder = playerOrder;

      updateRoundLicitacija(round.id, licData, (updErr) => {
        if (updErr) {
          console.error('Greška pri update-u licitacija:', updErr);
          return;
        }
      
        // Emit
        io.to(`game_${gameId}`).emit('licitacijaUpdated', licData);
      
        // Ako hoćeš, ako licData.finished == true, emit još "licitacijaFinished"
        // ...
      });
    });
  });

  // 3) Diskonekt
  socket.on('disconnect', () => {
    console.log(`Korisnik odvojen: ${socket.id}`);
  });
});

// --------------------
// Pokretanje servera
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server pokrenut na portu ${PORT}`);
});
