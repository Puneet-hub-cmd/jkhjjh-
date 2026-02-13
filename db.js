require('dotenv').config(); 
const mysql = require('mysql2');

// Connection create karo
const connection = mysql.createConnection({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT || 3306
});

// Connect karo
connection.connect((err) => {
  if (err) {
    console.error('Connection failed:', err);
  } else {
    console.log('✅ MySQL Connected!');
  }
});

module.exports = connection;
