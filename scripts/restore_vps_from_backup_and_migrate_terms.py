import sys
import os
import paramiko

HOST = '66.94.101.47'
USER = 'root'
PASSWORD = 'hLhlT2x2zv6qUl3mU9'

BACKUP_FILE = '/root/backups/eventapp_db_before_reset_20260412101239.sql'
CURRENT_SAFETY_BACKUP = '/root/backups/eventapp_db_before_terms_restore.sql'

PRECHECK_COMMANDS = [
    'ls -l /root/backups',
    f'file {BACKUP_FILE}',
    "docker exec eventapp-postgres psql -U eventapp_user -d event_app -t -c \"SELECT COUNT(*) FROM users;\"",
    "docker exec eventapp-postgres psql -U eventapp_user -d event_app -t -c \"SELECT COUNT(*) FROM events;\"",
]

RESTORE_COMMANDS = [
    'docker stop eventapp-backend',
    f"docker exec eventapp-postgres pg_dump -U eventapp_user -d event_app > {CURRENT_SAFETY_BACKUP}",
    "docker exec eventapp-postgres psql -U eventapp_user -d postgres -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'event_app' AND pid <> pg_backend_pid();\"",
    "docker exec eventapp-postgres psql -U eventapp_user -d postgres -c \"DROP DATABASE IF EXISTS event_app;\"",
    "docker exec eventapp-postgres psql -U eventapp_user -d postgres -c \"CREATE DATABASE event_app;\"",
    f"docker exec -i eventapp-postgres psql -U eventapp_user -d event_app < {BACKUP_FILE}",
    "docker exec eventapp-postgres psql -U eventapp_user -d event_app -c \"ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN NOT NULL DEFAULT FALSE;\"",
    "docker exec eventapp-postgres psql -U eventapp_user -d event_app -c \"ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;\"",
    "cd /root/projects/eventapp && docker compose -f deploy/docker-compose.vps.yml --env-file deploy/eventapp.vps.env up -d --build eventapp-backend",
]

VALIDATION_COMMANDS = [
    "docker exec eventapp-postgres psql -U eventapp_user -d event_app -t -c \"SELECT COUNT(*) FROM users;\"",
    "docker exec eventapp-postgres psql -U eventapp_user -d event_app -t -c \"SELECT COUNT(*) FROM events;\"",
    "docker exec eventapp-postgres psql -U eventapp_user -d event_app -t -c \"SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('terms_accepted','terms_accepted_at') ORDER BY column_name;\"",
    'curl -s https://66.94.101.47.sslip.io/api/health',
    "curl -s -o /tmp/terms_accept.out -w '%{http_code}' -X POST https://66.94.101.47.sslip.io/api/terms/accept -H 'Content-Type: application/json' -d '{}'",
    'cat /tmp/terms_accept.out',
]

REQUIRED_FLAG = '--i-understand-this-drops-event-app-db'
REQUIRED_ENV = 'ALLOW_DESTRUCTIVE_VPS_RESTORE'
REQUIRED_ENV_VALUE = 'DROP_EVENT_APP_DB'


def ensure_explicit_confirmation():
    has_flag = REQUIRED_FLAG in sys.argv[1:]
    env_value = os.environ.get(REQUIRED_ENV)

    if has_flag and env_value == REQUIRED_ENV_VALUE:
        return

    print('[BLOCKED] Refusing to run restore_vps_from_backup_and_migrate_terms.py without explicit confirmation.')
    print('This script stops the backend, backs up the current DB, DROPS `event_app`, recreates it, and restores a backup.')
    print('To run it intentionally, use BOTH:')
    print(f'  env {REQUIRED_ENV}={REQUIRED_ENV_VALUE}')
    print(f'  flag {REQUIRED_FLAG}')
    sys.exit(1)


def run_commands(client, commands, label):
    print(f'=== {label} ===')
    for cmd in commands:
      print(f'>>> {cmd}')
      stdin, stdout, stderr = client.exec_command(cmd, timeout=600)
      out = stdout.read().decode(errors='replace')
      err = stderr.read().decode(errors='replace')
      if out:
          sys.stdout.buffer.write(out.encode('utf-8', errors='replace'))
          sys.stdout.buffer.write(b'\n')
      if err:
          sys.stdout.buffer.write(err.encode('utf-8', errors='replace'))
          sys.stdout.buffer.write(b'\n')


def main():
    ensure_explicit_confirmation()

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=20)
    try:
        run_commands(client, PRECHECK_COMMANDS, 'PRECHECK')
        run_commands(client, RESTORE_COMMANDS, 'RESTORE')
        run_commands(client, VALIDATION_COMMANDS, 'VALIDATION')
    finally:
        client.close()


if __name__ == '__main__':
    main()
