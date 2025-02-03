const mysql = require('mysql');

const pool = mysql.createPool({
    connectionLimit: 10, // Maksimalni broj konekcija u pool-u
    host: 'localhost',
    user: 'root',
    password: 'andrija2005',
    database: 'meksiko',
});

module.exports = pool;
