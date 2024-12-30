import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import PlayerHand from './PlayerHand';
import Talon from './Talon';
import '../Styles/GameBoard.css';

// Povezivanje sa backendom putem Socket.IO
const socket = io('http://localhost:5000');

const GameBoard = ({ gameId, userId }) => {
    const [playerHand, setPlayerHand] = useState([]); // Karte igrača
    const [talonCards, setTalonCards] = useState([]); // Talon karte
    const [trump, setTrump] = useState(null); // Adut
    const [currentRound, setCurrentRound] = useState([]); // Trenutna runda
    const [results, setResults] = useState([]); // Rezultati

    // Funkcija za dohvatanje podataka o igri
    const fetchGameData = async () => {
        try {
            const response = await axios.get(`/api/games/${gameId}`);
            const { hand, talon_cards, trump, results } = response.data;
            setPlayerHand(JSON.parse(hand));
            setTalonCards(JSON.parse(talon_cards));
            setTrump(trump);
            setResults(results);
        } catch (error) {
            console.error('Error fetching game data:', error);
        }
    };

    // Funkcija za bacanje karte
    const playCard = (card) => {
        socket.emit('playCard', { gameId, userId, card });
        setPlayerHand(playerHand.filter((c) => c.id !== card.id)); // Ukloni kartu iz ruke
    };

    // Socket.IO listener za ažuriranje trenutne runde
    useEffect(() => {
        socket.on('roundUpdate', (data) => {
            setCurrentRound(data.currentRound);
            setResults(data.results);
        });

        return () => {
            socket.off('roundUpdate'); // Očisti listener
        };
    }, []);

    // Dohvatanje podataka pri inicijalizaciji
    useEffect(() => {
        fetchGameData();
    }, []);

    // Renderovanje komponenti
    return (
        <div className="game-board">
            {/* Informacije o igri */}
            <div className="game-info">
                <h1>Game Board</h1>
                <h2>Adut: {trump || 'Nije izabran'}</h2>
                <h3>Rezultati:</h3>
                <ul>
                    {results.map((res, index) => (
                        <li key={index}>
                            Igrač {res.userId}: {res.score} poena
                        </li>
                    ))}
                </ul>
            </div>

            {/* Talon prikazan na sredini */}
            <div className="game-talon">
                <Talon talonCards={talonCards} />
            </div>

            {/* Trenutna runda */}
            <div className="current-round">
                <h3>Trenutna runda:</h3>
                <div className="cards">
                    {currentRound.map((card, index) => (
                        <div key={index} className="card">
                            <img src={card.image} alt={`${card.value} ${card.suit}`} />
                        </div>
                    ))}
                </div>
            </div>

            {/* Karte igrača prikazane na dnu */}
            <div className="player-hand-container">
                <PlayerHand setTalonCards={setTalonCards} />
            </div>
        </div>
    );
};

export default GameBoard;
