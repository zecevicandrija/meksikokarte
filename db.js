const mysql = require('mysql');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'andrija2005',
    database: 'meksiko',
});

module.exports = db;