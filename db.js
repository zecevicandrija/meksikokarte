const mysql = require('mysql2');

const pool = mysql.createPool({
  connectionLimit: 5, 
  host: 'localhost',
  user: 'root',
  password: 'andrija2005',
  database: 'meksiko',
});

const promisePool = pool.promise();

module.exports = {
  pool,
  promisePool,
};