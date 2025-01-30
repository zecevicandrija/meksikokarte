const mysql = require('mysql');

const pool = mysql.createPool({
    host: 'bl0dfdtukgwdl9hjrwo5-mysql.services.clever-cloud.com',
    user: 'u0mee5xgufkiciv6',
    password: '6TwWjIT2LmaANtupiIdI',
    database: 'bl0dfdtukgwdl9hjrwo5',
    port: 3306,
});

module.exports = pool;
