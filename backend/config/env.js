const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBoolean = (value, fallback = false) => {
  if (typeof value !== 'string') {
    return fallback;
  }

  return value.toLowerCase() === 'true';
};

const config = {
  app: {
    port: parseNumber(process.env.PORT, 3001),
  },
  repository: {
    driver: process.env.REPOSITORY_DRIVER || 'postgres',
  },
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseNumber(process.env.POSTGRES_PORT, 5432),
    database: process.env.POSTGRES_DB || 'event_app',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || '',
    ssl: parseBoolean(process.env.POSTGRES_SSL, false),
  },
};

module.exports = { config };
