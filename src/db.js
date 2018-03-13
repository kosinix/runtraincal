const sqlite3 = require('sqlite3').verbose();
const sqlite3Db = new sqlite3.Database('app.db');
const promiseSqlite3 = require('promise-sqlite')
const db = new promiseSqlite3.DB(sqlite3Db, null);

module.exports = db;

