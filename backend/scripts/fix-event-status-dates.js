const { Client } = require('pg');
const { config } = require('../config/env');

const dryRun = !process.argv.includes('--apply');

const createClient = () => new Client({
  host: config.postgres.host,
  port: config.postgres.port,
  user: config.postgres.user,
  password: config.postgres.password,
  database: config.postgres.database,
  ssl: config.postgres.ssl ? { rejectUnauthorized: false } : false,
});

const normalizeStatus = (value) => {
  const status = String(value || '').toLowerCase();
  if (status === 'created' || status === 'not_started') return 'not_started';
  if (status === 'started' || status === 'active') return 'active';
  if (status === 'finished' || status === 'finalized') return 'finalized';
  return 'not_started';
};

const run = async () => {
  const client = createClient();
  await client.connect();

  try {
    const summary = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE LOWER(COALESCE(event_status, '')) IN ('created', 'started', 'finished')) AS alias_rows,
        COUNT(*) FILTER (WHERE start_real_at IS NOT NULL AND LOWER(COALESCE(event_status, '')) NOT IN ('active', 'started', 'finalized', 'finished')) AS start_status_mismatch_rows,
        COUNT(*) FILTER (WHERE end_real_at IS NOT NULL AND LOWER(COALESCE(event_status, '')) NOT IN ('finalized', 'finished')) AS end_status_mismatch_rows,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(event_status, '')) IN ('active', 'started') AND start_real_at IS NULL) AS missing_start_rows,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(event_status, '')) IN ('finalized', 'finished') AND end_real_at IS NULL) AS missing_end_rows,
        COUNT(*) FILTER (WHERE start_date > end_date) AS inverted_schedule_rows
      FROM events
    `);

    const stats = summary.rows[0] || {};
    console.log('Event lifecycle repair summary:');
    console.log(JSON.stringify(stats, null, 2));

    if (dryRun) {
      console.log('Dry run only. Re-run with --apply to update rows.');
      return;
    }

    await client.query('BEGIN');

    const updated = await client.query(`
      UPDATE events
      SET
        event_status = CASE LOWER(COALESCE(event_status, ''))
          WHEN 'created' THEN 'not_started'
          WHEN 'not_started' THEN 'not_started'
          WHEN 'started' THEN 'active'
          WHEN 'active' THEN 'active'
          WHEN 'finished' THEN 'finalized'
          WHEN 'finalized' THEN 'finalized'
          ELSE 'not_started'
        END,
        start_real_at = CASE
          WHEN LOWER(COALESCE(event_status, '')) IN ('active', 'started', 'finalized', 'finished') AND start_real_at IS NULL
            THEN COALESCE(start_date, start_real_at, NOW())
          ELSE start_real_at
        END,
        end_real_at = CASE
          WHEN LOWER(COALESCE(event_status, '')) IN ('finalized', 'finished') AND end_real_at IS NULL
            THEN COALESCE(end_date, end_real_at, NOW())
          ELSE end_real_at
        END,
        updated_at = NOW()
      WHERE
        LOWER(COALESCE(event_status, '')) IN ('created', 'started', 'finished', 'active', 'finalized')
        OR (LOWER(COALESCE(event_status, '')) IN ('active', 'started') AND start_real_at IS NULL)
        OR (LOWER(COALESCE(event_status, '')) IN ('finalized', 'finished') AND end_real_at IS NULL)
        OR (start_real_at IS NOT NULL AND LOWER(COALESCE(event_status, '')) NOT IN ('active', 'started', 'finalized', 'finished'))
        OR (end_real_at IS NOT NULL AND LOWER(COALESCE(event_status, '')) NOT IN ('finalized', 'finished'))
    `);

    console.log(`Updated ${updated.rowCount} event row(s).`);

    await client.query('COMMIT');
    console.log('Repair completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Repair failed:', error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
};

run();
