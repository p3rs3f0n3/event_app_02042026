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
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseNumber(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    secure: parseBoolean(process.env.SMTP_SECURE, false),
    requireTls: parseBoolean(process.env.SMTP_REQUIRE_TLS, false),
    fromEmail: process.env.SMTP_FROM_EMAIL || '',
    fromName: process.env.SMTP_FROM_NAME || 'Event App',
  },
};

module.exports = { config };
