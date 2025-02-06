const mysql = require('mysql');

const pool = mysql.createPool({
    connectionLimit: 10, // Maksimalni broj konekcija u pool-u
    host: 'localhost',
    user: 'root',
    password: 'andrija2005',
    database: 'meksiko',
});

// Promisify the query method
pool.queryAsync = function(query, params) {
    return new Promise((resolve, reject) => {
      this.query(query, params, (error, results, fields) => {
        if (error) return reject(error);
        resolve([results, fields]); // Mimic mysql2's promise format
      });
    });
  };

module.exports = pool;
