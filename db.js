const mysql = require('mysql2');

const pool = mysql.createPool({
  connectionLimit: 5, // Maksimalni broj konekcija u pool-u
  host: 'bl0dfdtukgwdl9hjrwo5-mysql.services.clever-cloud.com',
  user: 'u0mee5xgufkiciv6',
  password: '6TwWjIT2LmaANtupiIdI',
  database: 'bl0dfdtukgwdl9hjrwo5',
});

const promisePool = pool.promise();

module.exports = {
  pool,
  promisePool,
};