const { Pool } = require('pg');
const { config } = require('../../config/env');

const postgresConfig = {
  host: config.postgres.host,
  port: config.postgres.port,
  database: config.postgres.database,
  user: config.postgres.user,
  password: config.postgres.password,
  ssl: config.postgres.ssl ? { rejectUnauthorized: false } : false,
};

const pool = new Pool(postgresConfig);

pool.on('error', (error) => {
  console.error('❌ PostgreSQL pool error', error);
});

const query = (text, params) => pool.query(text, params);

module.exports = {
  pool,
  query,
};
