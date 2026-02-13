const mysql = require('mysql2');

// Connection create करो
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',             // तुम्हारा MySQL user
  password: 'Root@978',// तुम्हारा root password
  database: 'jewellery'     // project के हिसाब से database
});

// Connect करो
connection.connect((err) => {
  if (err) {
    console.error('Connection failed:', err);
  } else {
    console.log('✅ MySQL Connected!');
  }
});

module.exports = connection;
