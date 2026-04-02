const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { config } = require('../config/env');

const schemaPath = path.join(__dirname, '..', 'db', '01_schema.sql');
const seedPath = path.join(__dirname, '..', 'db', '02_seed.sql');

const createAdminClient = () => new Client({
  host: config.postgres.host,
  port: config.postgres.port,
  user: config.postgres.user,
  password: config.postgres.password,
  database: 'postgres',
  ssl: config.postgres.ssl ? { rejectUnauthorized: false } : false,
});

const createAppClient = () => new Client({
  host: config.postgres.host,
  port: config.postgres.port,
  user: config.postgres.user,
  password: config.postgres.password,
  database: config.postgres.database,
  ssl: config.postgres.ssl ? { rejectUnauthorized: false } : false,
});

const quoteIdentifier = (value) => `"${String(value).replace(/"/g, '""')}"`;

const run = async () => {
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const seedSql = fs.readFileSync(seedPath, 'utf8');

  const adminClient = createAdminClient();
  await adminClient.connect();

  try {
    const dbCheck = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [config.postgres.database]);

    if (dbCheck.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE ${quoteIdentifier(config.postgres.database)}`);
      console.log(`✅ Base creada: ${config.postgres.database}`);
    } else {
      console.log(`ℹ️ La base ya existe: ${config.postgres.database}`);
    }
  } finally {
    await adminClient.end();
  }

  const appClient = createAppClient();
  await appClient.connect();

  try {
    await appClient.query(schemaSql);
    console.log('✅ Schema aplicado');
    await appClient.query(seedSql);
    console.log('✅ Seed aplicado');
  } finally {
    await appClient.end();
  }
};

run().catch((error) => {
  console.error('❌ Error inicializando PostgreSQL');
  console.error(error);
  process.exit(1);
});
