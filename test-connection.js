require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Erro na conexão:', err);
  } else {
    console.log('Conectado com sucesso! Hora do servidor:', res.rows[0].now);
  }
  pool.end();
});