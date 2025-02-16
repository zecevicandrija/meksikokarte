const mysql = require('mysql');

const pool = mysql.createPool({
    connectionLimit: 5, // Maksimalni broj konekcija u pool-u
    host: 'bl0dfdtukgwdl9hjrwo5-mysql.services.clever-cloud.com',
    user: 'u0mee5xgufkiciv6',
    password: '6TwWjIT2LmaANtupiIdI',
    database: 'bl0dfdtukgwdl9hjrwo5',
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
