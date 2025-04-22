const express = require("express");
const { promisePool } = require("../db"); // Uvozimo promisePool iz db.js
const axios = require("axios");

module.exports = (io) => {
  const router = express.Router();

  // Pomoćna funkcija koja bezbedno parsira JSON
  function safeParse(data) {
    if (data == null) return data;
    if (typeof data === "string") {
      try {
        return JSON.parse(data);
      } catch (e) {
        console.error("Error parsing JSON:", e);
        return data;
      }
    }
    return data;
  }

  // [1] Pomoćna funkcija za pronalaženje najjače karte
  function findHighestCard(cards) {
    const valueOrder = ["7", "8", "9", "10", "J", "Q", "K", "A"];
    return cards.reduce((highest, card) => {
      return valueOrder.indexOf(card.card_value) > valueOrder.indexOf(highest.card_value)
        ? card
        : highest;
    });
  }

  // [2] Funkcija za generisanje špila od 32 karte
  function generateDeck() {
    const suits = ["♠", "♥", "♦", "♣"];
    const values = ["7", "8", "9", "10", "J", "Q", "K", "A"];
    const deck = [];
    for (const suit of suits) {
      for (const value of values) {
        deck.push({
          suit,
          value,
          image: `/Slike/${value}_${
            suit === "♠"
              ? "spades"
              : suit === "♥"
              ? "hearts"
              : suit === "♦"
              ? "diamonds"
              : "clubs"
          }.png`,
        });
      }
    }
    // Fisher-Yates mešanje
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  // [3] Pomoćna funkcija: kreiraj novu rundu direktno na serveru
  async function createNewRoundServerSide(gameId, io) {
    try {
      // 1) Dohvati poslednju rundu (da uzmemo player_order)
      const [roundRows] = await promisePool.query(
        "SELECT player_order FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 1",
        [gameId]
      );

      if (!roundRows || roundRows.length === 0) {
        throw new Error("Nema prethodne runde – nema player_order!");
      }

      const previousPlayerOrder = safeParse(roundRows[0].player_order) || [];
      const rotatedPlayerOrder = [
        ...previousPlayerOrder.slice(1),
        previousPlayerOrder[0],
      ];

      // Kreiraj inicijalnu licitaciju za novu rundu
      const novaLicitacija = {
        playerOrder: rotatedPlayerOrder,
        currentPlayerIndex: 0,
        bids: Array(rotatedPlayerOrder.length).fill(null),
        minBid: 5,
        passedPlayers: [],
        finished: false,
      };

      // 2) Napravi novu rundu u bazi
      const [insertResult] = await promisePool.query(
        `INSERT INTO rounds (game_id, player_order, licitacija, adut, talon_cards) 
         VALUES (?, ?, ?, NULL, NULL)`,
        [gameId, JSON.stringify(rotatedPlayerOrder), JSON.stringify(novaLicitacija)]
      );

      const newRoundId = insertResult.insertId;

      // 3) Generiši špil i podeli karte
      const deck = generateDeck();
      const playerHands = [
        deck.slice(0, 10),
        deck.slice(10, 20),
        deck.slice(20, 30),
      ];
      const talon = deck.slice(30, 32);

      // 4) Dohvati sve igrače (game_players) i ažuriraj im ruke
      const [players] = await promisePool.query(
        "SELECT id FROM game_players WHERE game_id = ? ORDER BY id ASC",
        [gameId]
      );

      const updates = players.map((player, idx) => {
        const handJSON = JSON.stringify(playerHands[idx] || []);
        return promisePool.query(
          "UPDATE game_players SET hand = ?, round_id = ? WHERE id = ?",
          [handJSON, newRoundId, player.id]
        );
      });

      await Promise.all(updates);

      // 5) Sačuvaj talon u rounds
      await promisePool.query(
        "UPDATE rounds SET talon_cards = ? WHERE id = ?",
        [JSON.stringify(talon), newRoundId]
      );

      // Emit događaje
      io.to(`game_${gameId}`).emit("licitacijaUpdated", novaLicitacija);
      io.to(`game_${gameId}`).emit("newRound", {
        roundId: newRoundId,
        playerOrder: rotatedPlayerOrder,
      });
      io.to(`game_${gameId}`).emit("nextTurn", {
        nextPlayerId: rotatedPlayerOrder[0],
      });

      return newRoundId;
    } catch (err) {
      console.error("Greška pri kreiranju nove runde:", err);
      throw err;
    }
  }

  // ---------------------------
  // [4] Ruta: Dodavanje novog bacanja
  // ---------------------------
  router.post("/:gameId", async (req, res) => {
    const { gameId } = req.params;
    const { playerId, cardValue, cardSuit } = req.body;
    const numericPlayerId = parseInt(playerId, 10);
    try {
      // Dohvati game_player ID (postojeći kod)
      const [playerResults] = await promisePool.query(
        "SELECT id FROM game_players WHERE game_id = ? AND user_id = ?",
        [gameId, numericPlayerId]
      );
      if (!playerResults.length) {
        return res.status(500).json({ error: "Igrač nije pronađen" });
      }
      const gamePlayerId = playerResults[0].id;
  
      // Dohvati aktivnu rundu sa player_order i current_active_player
      const [roundResults] = await promisePool.query(
        "SELECT id, player_order, current_active_player FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 1",
        [gameId]
      );
      if (!roundResults.length) {
        return res.status(500).send("Runda nije pronađena");
      }
      const roundId = roundResults[0].id;
      const playerOrder = safeParse(roundResults[0].player_order);
      const currentActivePlayer = roundResults[0].current_active_player;
  
      // Proveri da li je igrač na potezu
      if (currentActivePlayer !== numericPlayerId) {
        return res.status(400).json({ error: "Niste na potezu!" });
      }
  
      // Dodaj potez u bazu (postojeći kod)
      const [orderResults] = await promisePool.query(
        "SELECT MAX(play_order) AS maxOrder FROM card_plays WHERE round_id = ?",
        [roundId]
      );
      const newOrder = (orderResults[0]?.maxOrder || 0) + 1;
      await promisePool.query(
        "INSERT INTO card_plays (game_id, round_id, player_id, card_value, card_suit, play_order) VALUES (?, ?, ?, ?, ?, ?)",
        [gameId, roundId, gamePlayerId, cardValue, cardSuit, newOrder]
      );
  
      // Ažuriraj ruku igrača (postojeći kod)
      const [handResults] = await promisePool.query(
        "SELECT hand FROM game_players WHERE id = ?",
        [gamePlayerId]
      );
      const currentHand = safeParse(handResults[0].hand || "[]");
      const updatedHand = currentHand.filter(
        (c) => !(c.value === cardValue && c.suit === cardSuit)
      );
      await promisePool.query(
        "UPDATE game_players SET hand = ? WHERE id = ?",
        [JSON.stringify(updatedHand), gamePlayerId]
      );
  
      // Odredi sledećeg igrača i ažuriraj current_active_player
      const currentIndex = playerOrder.indexOf(numericPlayerId);
      if (currentIndex === -1) {
        return res.status(500).send("Igrač nije u redosledu");
      }
      const nextIndex = (currentIndex + 1) % playerOrder.length;
      const nextPlayerId = playerOrder[nextIndex];
  
      await promisePool.query(
        "UPDATE rounds SET current_active_player = ? WHERE id = ?",
        [nextPlayerId, roundId]
      );
  
      // Emituj događaje (postojeći kod prilagođen)
      io.to(`game_${gameId}`).emit("cardPlayed", {
        playerId: numericPlayerId,
        cardValue,
        cardSuit,
        image: `/Slike/${cardValue}_${cardSuit === "♠" ? "spades" : cardSuit === "♥" ? "hearts" : cardSuit === "♦" ? "diamonds" : "clubs"}.png`,
        nextPlayerId: nextPlayerId,
      });
      io.to(`game_${gameId}`).emit("handUpdated", {
        userId: numericPlayerId,
        newHand: updatedHand,
      });
      io.to(`game_${gameId}`).emit("nextTurn", { nextPlayerId });
      io.to(`game_${gameId}`).emit("updateTable", { roundId, gameId });
  
      res.status(200).send("Karta uspešno bačena");
    } catch (err) {
      console.error("Greška pri dodavanju bacanja:", err);
      res.status(500).send("Došlo je do greške pri dodavanju bacanja");
    }
  });

  // [5] Ruta: Dohvati sva bacanja za rundu
  router.get("/:roundId", async (req, res) => {
    const { roundId } = req.params;

    try {
      // Dohvati sva bacanja za rundu
      const [results] = await promisePool.query(
        "SELECT * FROM card_plays WHERE round_id = ? ORDER BY play_order ASC",
        [roundId]
      );

      // Vrati rezultate kao JSON
      res.status(200).json(results);
    } catch (err) {
      console.error("Greška pri dohvatanju bacanja:", err);
      res.status(500).send("Greška pri dohvatanju bacanja.");
    }
  });

  // [6] Logika za ko nosi karte
  router.post("/:gameId/resolveTurn", async (req, res) => {
    const { gameId } = req.params;
    console.log("Početak resolveTurn za igru:", gameId);

    try {
      // 1) Dohvati ID i adut iz rounds
      const [adutResults] = await promisePool.query(
        "SELECT id, adut FROM rounds WHERE game_id = ? ORDER BY id DESC LIMIT 1",
        [gameId]
      );

      if (!adutResults.length) {
        console.error("Runda nije pronađena");
        return res.status(500).json({ error: "Runda nije pronađena." });
      }

      const { id: roundId, adut: trumpSuit } = adutResults[0];

      // 2) Dohvati sve karte koje su odigrane, a nisu "resolved"
      const [playedCards] = await promisePool.query(
        `
        SELECT card_value, card_suit, player_id, resolved, play_order
        FROM card_plays
        WHERE game_id = ? AND resolved = 0
        ORDER BY play_order ASC
      `,
        [gameId]
      );

      // Ako nema 3 nove karte, potez još nije kompletiran
      if (playedCards.length !== 3) {
        console.log(
          `Nema dovoljno (3) odigranih karata. Trenutno: ${playedCards.length}`
        );
        return res.status(400).json({ error: "Not enough cards played" });
      }

      // 3) Odredi pobedničku kartu
      const firstSuit = playedCards[0].card_suit;
      const trumpCards = playedCards.filter(
        (card) => card.card_suit === trumpSuit
      );

      let winnerCard;
      if (trumpCards.length > 0) {
        winnerCard = findHighestCard(trumpCards);
      } else {
        const sameSuitCards = playedCards.filter(
          (card) => card.card_suit === firstSuit
        );
        winnerCard = findHighestCard(sameSuitCards);
      }

      const winnerPlayerId = winnerCard.player_id;
      console.log("Pobednička karta:", winnerCard);

      // 4) Dohvati user_id za pobedničkog player_id
      const [userResults] = await promisePool.query(
        `SELECT user_id FROM game_players WHERE id = ?`,
        [winnerPlayerId]
      );

      if (!userResults.length) {
        console.error("Pobednik nije pronađen");
        return res.status(500).json({ error: "Pobednik nije pronađen." });
      }

      const winnerUserId = userResults[0].user_id;

      // 5a) Upiši winner_player_id za ove karte
      await promisePool.query(
        `
        UPDATE card_plays
        SET winner_player_id = ?
        WHERE game_id = ? AND resolved = 0
      `,
        [winnerPlayerId, gameId]
      );

       // Ažuriraj current_active_player u bazi
    await promisePool.query(
      "UPDATE rounds SET current_active_player = ? WHERE id = ?",
      [winnerUserId, roundId]
    );

      // 5b) +1 score
      await promisePool.query(
        `UPDATE game_players 
         SET score = score + 1
         WHERE game_id = ? AND user_id = ?`,
        [gameId, winnerUserId]
      );

      console.log(`+1 poen za user_id=${winnerUserId} u gameId=${gameId}`);

      // Emit scoreUpdated
      io.to(`game_${gameId}`).emit("scoreUpdated", {
        userId: winnerUserId,
      });

      // 6) Markiraj karte kao resolved
      await promisePool.query(
        `UPDATE card_plays 
         SET resolved = 1 
         WHERE game_id = ? AND resolved = 0`,
        [gameId]
      );

      // Emit clearTable event
      io.to(`game_${gameId}`).emit("clearTable", {
        winnerId: winnerUserId,
      });

      // 7) Proveri da li svi igrači nemaju karte
      const [players] = await promisePool.query(
        "SELECT hand FROM game_players WHERE game_id = ?",
        [gameId]
      );

      const allEmpty = players.every((p) => {
        const arr = safeParse(p.hand || "[]");
        return arr.length === 0;
      });

      if (allEmpty) {
         await promisePool.query(
    "UPDATE rounds SET finished = 1 WHERE id = ?",
    [roundId]
  );

        // Svi igrači su potrošili karte – kraj runde.
        // Prvo proveravamo licitaciju
        const [licRows] = await promisePool.query(
          "SELECT licitacija FROM rounds WHERE id = ?",
          [roundId]
        );

        let licData = {};
        if (licRows && licRows.length) {
          licData = safeParse(licRows[0].licitacija || "{}");
        }

        // Ako je licitacija završena i imamo pobednika, obrađujemo to
        if (licData.finished && licData.winnerId) {
          const licWinnerUserId = licData.winnerId;
          const idx = licData.playerOrder.indexOf(licWinnerUserId);
          const finalBid =
            licData.bids && licData.bids[idx] ? licData.bids[idx] : 0;

          // Prebroj koliko nošenja je osvojio taj igrač u ovoj rundi
          const [wonRows] = await promisePool.query(
            `SELECT COUNT(DISTINCT FLOOR((play_order - 1) / 3)) AS totalWon
           FROM card_plays
           WHERE round_id = ? 
             AND winner_player_id IS NOT NULL 
             AND winner_player_id = (
               SELECT id FROM game_players 
               WHERE game_id = ? AND user_id = ?
             )`,
            [roundId, gameId, licWinnerUserId]
          );

          const totalWon = (wonRows && wonRows[0] && wonRows[0].totalWon) || 0;
          console.log(
            `Igrač ${licWinnerUserId} licitirao ${finalBid}, osvojio ${totalWon} nošenja.`
          );

          // Obrada slučaja “Meksiko”
          if (finalBid === 11) {
            if (totalWon === 10) {
              // Igrač je osvojio – dodaj +100
              await promisePool.query(
                `UPDATE game_players 
               SET score = score + 100 
               WHERE game_id = ? AND user_id = ?`,
                [gameId, licWinnerUserId]
              );

              // Proveri skor da li je neko dostigao 51 ili više
              const [scoreResults] = await promisePool.query(
                "SELECT user_id, score FROM game_players WHERE game_id = ?",
                [gameId]
              );

              const updatedScores = scoreResults.map((r) => ({
                userId: r.user_id,
                score: r.score,
              }));
              const maxScore = Math.max(...updatedScores.map((s) => s.score));
              const topPlayers = updatedScores.filter(
                (s) => s.score === maxScore
              );

              // Ako maksimalan rezultat nije barem 51, starta se nova runda
              if (maxScore < 51) {
                await createNewRoundServerSide(gameId, io);
                return res.status(200).json({ message: "Nova runda je startovana." });
              }

              // Ako postoji jedinstveni igrač sa najvišim rezultatom ≥ 51, igra se završava
              if (topPlayers.length === 1) {
                io.to(`game_${gameId}`).emit("gameOver", {
                  winnerId: topPlayers[0].userId,
                  scores: updatedScores,
                });
                await promisePool.query(
                  "UPDATE rounds SET licitacija = JSON_SET(COALESCE(licitacija, '{}'), '$.finished', CAST(true AS JSON)) WHERE id = ?",
                  [roundId]
                );
                return res.status(200).json({ message: "Igra je gotova" });
              } else {
                // Ako više igrača deli najviši rezultat, pokrećemo tie-break rundu
                io.to(`game_${gameId}`).emit("newRoundTieBreak", {
                  tiedPlayers: topPlayers.map((p) => p.userId),
                });
                await promisePool.query(
                  "UPDATE rounds SET licitacija = JSON_SET(COALESCE(licitacija, '{}'), '$.finished', CAST(true AS JSON)) WHERE id = ?",
                  [roundId]
                );
                await createNewRoundServerSide(gameId, io);
                return res.status(200).json({
                  message: "Tie detected, nova runda je startovana.",
                });
              }
            } else {
              // Penalizacija – igrač nije osvojio dovoljan broj nošenja
              const penalty = 40;
              await promisePool.query(
                `UPDATE game_players 
               SET score = score - ? 
               WHERE game_id = ? AND user_id = ?`,
                [penalty, gameId, licWinnerUserId]
              );

              io.to(`game_${gameId}`).emit("scoreUpdated", {
                userId: licWinnerUserId,
                penalty: penalty,
              });

              if (totalWon > 0) {
                await promisePool.query(
                  `UPDATE game_players
                 SET score = score - ?
                 WHERE game_id = ? AND user_id = ?`,
                  [totalWon, gameId, licWinnerUserId]
                );
              }
            }
          } else if (totalWon < finalBid) {
            // Standardni penal za nedovoljno nošenja
            const penalty = 2 * finalBid;
            await promisePool.query(
              `UPDATE game_players
             SET score = score - ?
             WHERE game_id = ? AND user_id = ?`,
              [penalty, gameId, licWinnerUserId]
            );

            console.log(
              `Penal ${penalty} i -${totalWon} za igrača ${licWinnerUserId}`
            );
            io.to(`game_${gameId}`).emit("scoreUpdated", {
              userId: licWinnerUserId,
            });

            if (totalWon > 0) {
              await promisePool.query(
                `UPDATE game_players
               SET score = score - ?
               WHERE game_id = ? AND user_id = ?`,
                [totalWon, gameId, licWinnerUserId]
              );
            }
          }
        }

        // Nakon obrade licitacije kada su svi bez karata,
        // proveravamo da li je igra završena (score ≥ 51)
        const [scoreResults] = await promisePool.query(
          "SELECT user_id, score FROM game_players WHERE game_id = ?",
          [gameId]
        );

        const scores = scoreResults.map((r) => ({
          userId: r.user_id,
          score: r.score,
        }));
        const maxScore = Math.max(...scores.map((s) => s.score));
        const topPlayers = scores.filter((s) => s.score === maxScore);

        // Ako maksimalan rezultat nije barem 51, pokrećemo novu rundu
        if (maxScore < 51) {
          await createNewRoundServerSide(gameId, io);
          return res.status(200).json({ message: "Nova runda je startovana." });
        }

        // Ako postoji jedinstveni igrač sa najvišim rezultatom ≥ 51, igra se završava
        if (topPlayers.length === 1) {
          const winnerId = topPlayers[0].userId;

          // Ažuriraj status igre na 'finished' i postavi pobednika
          await promisePool.query(
            "UPDATE games SET pobednik = ?, status = 'finished' WHERE id = ?",
            [winnerId, gameId]
          );

          // Dohvati podatke o učesnicima iz game_players i korisnici
          const [playerResults] = await promisePool.query(
            `SELECT gp.user_id, k.ime, k.prezime, gp.score
           FROM game_players gp
           JOIN korisnici k ON gp.user_id = k.id
           WHERE gp.game_id = ?`,
            [gameId]
          );

          // Kreiraj JSON niz sa podacima o učesnicima
          const playersData = playerResults.map((row) => ({
            user_id: row.user_id,
            ime: row.ime,
            prezime: row.prezime,
            score: row.score,
          }));

          // Unesi podatke u tabelu istorija
          await promisePool.query(
            "INSERT INTO istorija (game_id, players, winner_id) VALUES (?, ?, ?)",
            [gameId, JSON.stringify(playersData), winnerId]
          );

          console.log("Istorija partije uspešno uneta.");

          // Ažuriraj rundu - označi rundu kao završenu
          await promisePool.query(
            "UPDATE rounds SET licitacija = JSON_SET(COALESCE(licitacija, '{}'), '$.finished', CAST(true AS JSON)) WHERE id = ?",
            [roundId]
          );

          // Obavesti klijente da je igra završena
          io.to(`game_${gameId}`).emit("gameOver", {
            winnerId: winnerId,
            scores,
          });

          if (maxScore >= 51) {
            if (topPlayers.length === 1) {
              const winnerId = topPlayers[0].userId;
          
              // Ažuriraj status igre na 'finished' i postavi pobednika
              await promisePool.query(
                "UPDATE games SET pobednik = ?, status = 'finished' WHERE id = ?",
                [winnerId, gameId]
              );
          
              // Dohvati podatke o učesnicima iz game_players i korisnici
              const [playerResults] = await promisePool.query(
                `SELECT gp.user_id, k.ime, k.prezime, gp.score
                 FROM game_players gp
                 JOIN korisnici k ON gp.user_id = k.id
                 WHERE gp.game_id = ?`,
                [gameId]
              );
          
              const playersData = playerResults.map((row) => ({
                user_id: row.user_id,
                ime: row.ime,
                prezime: row.prezime,
                score: row.score,
              }));
          
              // Unesi podatke u tabelu istorija
              await promisePool.query(
                "INSERT INTO istorija (game_id, players, winner_id) VALUES (?, ?, ?)",
                [gameId, JSON.stringify(playersData), winnerId]
              );
          
              console.log("Istorija partije uspešno uneta.");
          
              // Ažuriraj rundu - označi rundu kao završenu
              await promisePool.query(
                "UPDATE rounds SET licitacija = JSON_SET(COALESCE(licitacija, '{}'), '$.finished', CAST(true AS JSON)) WHERE id = ?",
                [roundId]
              );
          
              io.to(`game_${gameId}`).emit("gameOver", {
                winnerId: winnerId,
                scores,
              });
          
              // Automatski pozovi rutu za završetak igre i dodelu tokena
              try {
                await axios.post(`http://localhost:5000/api/games/${gameId}/finish`);
                console.log(`Igra ${gameId} je završena i tokeni su dodeljeni.`);
              } catch (error) {
                console.error(`Greška pri završetku igre ${gameId}:`, error);
              }
          
              return res.status(200).json({ message: "Igra je gotova" });
            }
          }

          return res.status(200).json({ message: "Igra je gotova" });
        } else {
          // Ako više igrača deli najviši rezultat, pokrećemo tie-break rundu
          io.to(`game_${gameId}`).emit("newRoundTieBreak", {
            tiedPlayers: topPlayers.map((p) => p.userId),
          });

          await promisePool.query(
            "UPDATE rounds SET licitacija = JSON_SET(COALESCE(licitacija, '{}'), '$.finished', CAST(true AS JSON)) WHERE id = ?",
            [roundId]
          );

          console.log("Tie detected among players, starting tie-break round.");
          await createNewRoundServerSide(gameId, io);
          return res.status(200).json({
            message: "Tie detected, nova runda je startovana.",
          });
        }
      } else {
        // Ako nisu svi bez karata, prelazimo na sledeći potez
        io.to(`game_${gameId}`).emit("nextTurn", {
          nextPlayerId: winnerUserId,
        });
        return res.status(200).send("Turn resolved successfully.");
      }
    } catch (err) {
      console.error("Greška pri resolveTurn:", err);
      return res.status(500).json({ error: "Došlo je do greške pri resolveTurn." });
    }
  });

  // [7] Ruta: Trenutno na stolu -> GET
  router.get("/:gameId/currentTable", async (req, res) => {
    const { gameId } = req.params;

    try {
      // Dohvati sve karte koje su odigrane, a nisu "resolved"
      const [results] = await promisePool.query(
        "SELECT * FROM card_plays WHERE game_id = ? AND resolved = 0 ORDER BY play_order ASC",
        [gameId]
      );

      res.status(200).json({ playedCards: results });
    } catch (err) {
      console.error("Greška pri dohvatanju trenutnog stola:", err);
      res.status(500).send("Greška u bazi podataka.");
    }
  });

  return router;
};