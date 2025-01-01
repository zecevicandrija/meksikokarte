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

const gamePlayersRoutes = require('./routes/gamePlayers');
app.use('/api/game-players', gamePlayersRoutes);

const roundsRoutes = require('./routes/rounds');
app.use('/api/rounds', roundsRoutes);

const authRouter = require('./routes/auth');
const korisniciRouter = require('./routes/korisnici');

app.use('/api/auth', authRouter);
app.use('/api/korisnici', korisniciRouter);

// Socket.IO logika
io.on('connection', (socket) => {
    console.log(`Korisnik povezan: ${socket.id}`);

    // Pridruživanje sobi igre
    socket.on('joinGame', async ({ gameId, userId }) => {
        if (!gameId || !userId) {
            console.error('Nedostaju podaci: gameId ili userId');
            return;
        }
        
        socket.join(`game_${gameId}`);
        console.log(`Korisnik ${userId} se pridružio igri ${gameId}`);
    
        // Provera da li igrač već postoji u game_players tabeli
        db.query(
            'SELECT * FROM game_players WHERE game_id = ? AND user_id = ?',
            [gameId, userId],
            (err, results) => {
                if (err) {
                    console.error(err);
                    return;
                }
    
                if (results.length === 0) {
                    // Ako igrač ne postoji, ubaci ga u tabelu game_players
                    db.query(
                        'INSERT INTO game_players (game_id, user_id, score) VALUES (?, ?, ?)',
                        [gameId, userId, 0],
                        (err) => {
                            if (err) {
                                console.error('Greška prilikom dodavanja igrača:', err);
                            } else {
                                console.log(`Igrač ${userId} dodat u igru ${gameId}`);
                                io.to(`game_${gameId}`).emit('playerJoined', { userId });
                            }
                        }
                    );
                } else {
                    console.log(`Igrač ${userId} već postoji u igri ${gameId}`);
                }
            }
        );
    });
    

    // Deljenje karata
    socket.on('startGame', async ({ gameId }) => {
        db.query(
            'SELECT user_id FROM game_players WHERE game_id = ?',
            [gameId],
            (err, results) => {
                if (err) {
                    console.error(err);
                } else {
                    const players = results.map((row) => row.user_id);
                    const deck = generateDeck(); // Generisanje špila
                    const shuffledDeck = deck.sort(() => Math.random() - 0.5);
    
                    players.forEach((playerId, index) => {
                        const hand = shuffledDeck.slice(index * 10, (index + 1) * 10);
    
                        // Sačuvaj karte u bazi
                        db.query(
                            'UPDATE game_players SET hand = ? WHERE game_id = ? AND user_id = ?',
                            [JSON.stringify(hand), gameId, playerId]
                        );
    
                        // Pošalji karte klijentu
                        io.to(`game_${gameId}`).emit('dealCards', { userId: playerId, hand });
                    });
    
                    io.to(`game_${gameId}`).emit('gameStarted', { players });
                }
            }
        );
    });

    // Bacanje karata
    socket.on('playCard', async ({ gameId, userId, card }) => {
        db.query(
            'INSERT INTO rounds (game_id, player_id, card_played) VALUES (?, ?, ?)',
            [gameId, userId, JSON.stringify(card)],
            (err) => {
                if (err) {
                    console.error(err);
                } else {
                    io.to(`game_${gameId}`).emit('cardPlayed', { userId, card });
                }
            }
        );
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
