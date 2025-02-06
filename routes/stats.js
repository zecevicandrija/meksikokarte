// routes/stats.js
const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/:userId', (req, res) => {
  const { userId } = req.params;

  // Odredi početak i kraj trenutnog meseca
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Formatiraj datume u MySQL format: "YYYY-MM-DD HH:MM:SS"
  const formatDate = (date) => {
    return date.toISOString().slice(0, 19).replace('T', ' ');
  };
  const startOfMonthStr = formatDate(startOfMonth);
  const startOfNextMonthStr = formatDate(startOfNextMonth);

  /*  
      Statistike:
  
      1. Ukupno odigranih partija (svi zapisi u tabeli game_players za tog korisnika)
      2. Ukupno pobeda (svi zapisi iz games gde je pobednik = userId)
  
      3. Odigranih u ovom mesecu (spajanjem sa games.created_at)
      4. Poeni u ovom mesecu (saberani score iz game_players, spojen preko games.created_at)
      5. Pobeda u ovom mesecu (games gde je pobednik = userId i datum unutar meseca)
      6. Najbolji mesec (vrednost iz kolone korisnici.najbolji_mesec)
  */

  // 1. Ukupno odigranih partija (svi zapisi u game_players za korisnika)
  const totalGamesOverallQuery = `
    SELECT COUNT(*) AS totalGamesOverall
    FROM game_players
    WHERE user_id = ?
  `;

  // 2. Ukupno pobeda (svi zapisi u games gde je pobednik = userId)
  const totalWinsOverallQuery = `
    SELECT COUNT(*) AS totalWinsOverall
    FROM games
    WHERE pobednik = ?
  `;

  // 3. Ukupno odigranih partija u ovom mesecu (spajanjem na games.created_at)
  const totalGamesMonthQuery = `
    SELECT COUNT(*) AS totalGamesMonth
    FROM game_players gp
    JOIN games g ON gp.game_id = g.id
    WHERE gp.user_id = ?
      AND g.created_at >= ?
      AND g.created_at < ?
  `;

  // 4. Ukupno poena u ovom mesecu
  const totalScoreMonthQuery = `
    SELECT COALESCE(SUM(gp.score), 0) AS totalScoreMonth
    FROM game_players gp
    JOIN games g ON gp.game_id = g.id
    WHERE gp.user_id = ?
      AND g.created_at >= ?
      AND g.created_at < ?
  `;

  // 5. Broj pobeda u ovom mesecu
  const winsMonthQuery = `
    SELECT COUNT(*) AS winsMonth
    FROM games
    WHERE pobednik = ?
      AND created_at >= ?
      AND created_at < ?
  `;

  // 6. Čitanje vrednosti "najbolji_mesec" iz tabele korisnici
  const bestMonthQuery = `
    SELECT najbolji_mesec
    FROM korisnici
    WHERE id = ?
  `;

  // Izvršavamo upite jedan za drugim
  db.query(totalGamesOverallQuery, [userId], (err, totalOverallResults) => {
    if (err) {
      console.error('Greška pri dohvatanju ukupno odigranih partija:', err);
      return res.status(500).json({ error: 'Greška u bazi podataka' });
    }
    db.query(totalWinsOverallQuery, [userId], (err, winsOverallResults) => {
      if (err) {
        console.error('Greška pri dohvatanju ukupnih pobeda:', err);
        return res.status(500).json({ error: 'Greška u bazi podataka' });
      }
      db.query(totalGamesMonthQuery, [userId, startOfMonthStr, startOfNextMonthStr], (err, totalMonthResults) => {
        if (err) {
          console.error('Greška pri dohvatanju odigranih partija ovog meseca:', err);
          return res.status(500).json({ error: 'Greška u bazi podataka' });
        }
        db.query(totalScoreMonthQuery, [userId, startOfMonthStr, startOfNextMonthStr], (err, scoreMonthResults) => {
          if (err) {
            console.error('Greška pri dohvatanju poena ovog meseca:', err);
            return res.status(500).json({ error: 'Greška u bazi podataka' });
          }
          db.query(winsMonthQuery, [userId, startOfMonthStr, startOfNextMonthStr], (err, winsMonthResults) => {
            if (err) {
              console.error('Greška pri dohvatanju pobeda ovog meseca:', err);
              return res.status(500).json({ error: 'Greška u bazi podataka' });
            }
            db.query(bestMonthQuery, [userId], (err, bestMonthResults) => {
              if (err) {
                console.error('Greška pri dohvatanju najboljeg meseca:', err);
                return res.status(500).json({ error: 'Greška u bazi podataka' });
              }
              
              res.json({
                totalGamesOverall: totalOverallResults[0].totalGamesOverall,
                totalWinsOverall: winsOverallResults[0].totalWinsOverall,
                totalGamesMonth: totalMonthResults[0].totalGamesMonth,
                totalScoreMonth: scoreMonthResults[0].totalScoreMonth,
                winsMonth: winsMonthResults[0].winsMonth,
                bestMonth: bestMonthResults.length > 0 ? bestMonthResults[0].najbolji_mesec : 0
              });
            });
          });
        });
      });
    });
  });
});

module.exports = router;
