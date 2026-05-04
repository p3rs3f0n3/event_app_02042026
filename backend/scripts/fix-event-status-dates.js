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

const run = async () => {
  const client = createClient();
  await client.connect();

  try {
    console.log('--- EVENT STATUS UNIFICATION MIGRATION ---');
    console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'APPLY (writing to DB)'}`);

    const summary = await client.query(`
      SELECT
        COUNT(*) AS total_events,
        COUNT(*) FILTER (WHERE event_status IN ('not_started', 'active', 'finalized')) AS old_status_count,
        COUNT(*) FILTER (WHERE event_status = 'created' AND end_date < NOW()) AS pending_expiry_count,
        COUNT(*) FILTER (WHERE start_real_at IS NOT NULL AND event_status = 'created') AS missing_started_status,
        COUNT(*) FILTER (WHERE end_real_at IS NOT NULL AND event_status IN ('created', 'started')) AS missing_finished_status
      FROM events
    `);

    const stats = summary.rows[0] || {};
    console.log('Migration summary stats:');
    console.log(JSON.stringify(stats, null, 2));

    if (dryRun) {
      console.log('\nDry run only. Re-run with --apply to update rows.');
      return;
    }

    await client.query('BEGIN');

    // 1. Map nomenclature and fix status based on real dates
    const migration = await client.query(`
      UPDATE events
      SET
        event_status = CASE
          -- Priority: Real end date -> finished
          WHEN end_real_at IS NOT NULL THEN 'finished'
          -- Priority: Real start date -> started
          WHEN start_real_at IS NOT NULL THEN 'started'
          -- Priority: Expired date (never started) -> inactive_by_date
          WHEN event_status IN ('created', 'not_started') AND end_date < NOW() THEN 'inactive_by_date'
          -- Nomenclature mapping
          WHEN event_status IN ('not_started', 'created', 'pending') THEN 'created'
          WHEN event_status IN ('active', 'started') THEN 'started'
          WHEN event_status IN ('finalized', 'finished') THEN 'finished'
          ELSE COALESCE(event_status, 'created')
        END,
        status = CASE
          WHEN end_real_at IS NOT NULL THEN 'Finalizado'
          WHEN start_real_at IS NOT NULL THEN 'En curso'
          WHEN event_status IN ('created', 'not_started') AND end_date < NOW() THEN 'Inactivo por fecha'
          WHEN event_status IN ('not_started', 'created', 'pending') THEN 'Pendiente'
          WHEN event_status IN ('active', 'started') THEN 'En curso'
          WHEN event_status IN ('finalized', 'finished') THEN 'Finalizado'
          ELSE status
        END,
        updated_at = NOW()
      WHERE
        event_status IN ('not_started', 'active', 'finalized', 'pending', 'expired')
        OR (event_status = 'created' AND end_date < NOW())
        OR (start_real_at IS NOT NULL AND event_status = 'created')
        OR (end_real_at IS NOT NULL AND event_status <> 'finished')
    `);

    console.log(`\nUpdated ${migration.rowCount} event row(s) to new status nomenclature.`);

    // 2. Fix missing dates for consistent reporting
    const dateFix = await client.query(`
      UPDATE events
      SET
        start_real_at = COALESCE(start_real_at, start_date, NOW()),
        updated_at = NOW()
      WHERE event_status IN ('started', 'finished') AND start_real_at IS NULL
    `);

    if (dateFix.rowCount > 0) {
      console.log(`Backfilled start_real_at for ${dateFix.rowCount} started/finished events.`);
    }

    const endDateFix = await client.query(`
      UPDATE events
      SET
        end_real_at = COALESCE(end_real_at, end_date, NOW()),
        updated_at = NOW()
      WHERE event_status = 'finished' AND end_real_at IS NULL
    `);

    if (endDateFix.rowCount > 0) {
      console.log(`Backfilled end_real_at for ${endDateFix.rowCount} finished events.`);
    }

    await client.query('COMMIT');
    console.log('\nMigration completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\nMigration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
};

run();
