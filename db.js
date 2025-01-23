const mysql = require('mysql');

const pool = mysql.createPool({
    connectionLimit: 10, // Maksimalni broj konekcija u pool-u
    host: 'undovrbas.com',
    user: 'undovrba_andrija',
    password: 'andrija2005',
    database: 'undovrba_meksiko'
});

module.exports = pool;
