const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { config } = require('../config/env');

const migrationsDir = path.join(__dirname, '..', 'migrations');

const createClient = () => new Client({
  host: config.postgres.host,
  port: config.postgres.port,
  database: config.postgres.database,
  user: config.postgres.user,
  password: config.postgres.password,
  ssl: config.postgres.ssl ? { rejectUnauthorized: false } : false,
});

const ensureMigrationsTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

const readMigrationFiles = () => {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  return fs.readdirSync(migrationsDir)
    .filter((file) => file.toLowerCase().endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, 'en'))
    .map((file) => ({ file, fullPath: path.join(migrationsDir, file) }));
};

const run = async () => {
  const client = createClient();
  await client.connect();

  try {
    await ensureMigrationsTable(client);

    const appliedResult = await client.query('SELECT filename FROM migrations');
    const applied = new Set(appliedResult.rows.map((row) => row.filename));
    const migrations = readMigrationFiles();

    for (const migration of migrations) {
      if (applied.has(migration.file)) {
        console.log(`SKIP ${migration.file}`);
        continue;
      }

      const sql = fs.readFileSync(migration.fullPath, 'utf8');
      await client.query('BEGIN');

      try {
        await client.query(sql);
        await client.query('INSERT INTO migrations (filename) VALUES ($1)', [migration.file]);
        await client.query('COMMIT');
        console.log(`APPLIED ${migration.file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    console.log('Migrations completed');
  } finally {
    await client.end();
  }
};

run().catch((error) => {
  console.error('Migration failed');
  console.error(error);
  process.exit(1);
});
