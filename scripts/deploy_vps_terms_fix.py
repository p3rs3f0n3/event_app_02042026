import os
import posixpath
import paramiko
import sys

HOST = '66.94.101.47'
USER = 'root'
PASSWORD = 'hLhlT2x2zv6qUl3mU9'
LOCAL_ROOT = r'D:\Desarrollos\claude_code\event_app'
REMOTE_ROOT = '/root/projects/eventapp'

FILES_TO_UPLOAD = [
    'backend/server.js',
    'backend/utils/validation.js',
    'backend/utils/adminRecords.js',
    'backend/utils/mailer.js',
    'backend/config/env.js',
    'backend/repositories/eventAppRepository.js',
    'backend/repositories/postgresEventAppRepository.js',
    'backend/db/01_schema.sql',
    'backend/db/02_seed.sql',
    'backend/data/initialDb.js',
]

REMOTE_COMMANDS = [
    'cd /root/projects/eventapp && docker compose -f deploy/docker-compose.vps.yml --env-file deploy/eventapp.vps.env up -d --build eventapp-backend',
    'docker exec eventapp-backend npm run db:init',
    'cd /root/projects/eventapp && docker compose -f deploy/docker-compose.vps.yml --env-file deploy/eventapp.vps.env ps',
    'curl -s https://66.94.101.47.sslip.io/api/health',
    "curl -s -o /tmp/terms_accept.out -w '%{http_code}' -X POST https://66.94.101.47.sslip.io/api/terms/accept -H 'Content-Type: application/json' -d '{}'",
    'cat /tmp/terms_accept.out',
]


def upload_files():
    transport = paramiko.Transport((HOST, 22))
    transport.connect(username=USER, password=PASSWORD)
    sftp = paramiko.SFTPClient.from_transport(transport)
    try:
        for rel in FILES_TO_UPLOAD:
            local_path = os.path.join(LOCAL_ROOT, *rel.split('/'))
            remote_path = posixpath.join(REMOTE_ROOT, *rel.split('/'))
            sftp.put(local_path, remote_path)
            print(f'uploaded {rel}')
    finally:
        sftp.close()
        transport.close()


def run_remote_commands():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=20)
    try:
        for cmd in REMOTE_COMMANDS:
            print(f'>>> {cmd}')
            stdin, stdout, stderr = client.exec_command(cmd, timeout=240)
            out = stdout.read().decode()
            err = stderr.read().decode()
            if out:
                sys.stdout.buffer.write(out.encode('utf-8', errors='replace'))
                sys.stdout.buffer.write(b'\n')
            if err:
                sys.stdout.buffer.write(err.encode('utf-8', errors='replace'))
                sys.stdout.buffer.write(b'\n')
    finally:
        client.close()


if __name__ == '__main__':
    upload_files()
    run_remote_commands()
