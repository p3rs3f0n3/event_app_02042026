import argparse
import datetime as dt
import os
import posixpath
import sys

import paramiko


DEFAULT_LOCAL_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DEFAULT_REMOTE_ROOT = '/root/projects/eventapp'
DEFAULT_HEALTHCHECK_URL = 'https://66.94.101.47.sslip.io/api/health'
UPLOAD_DIRS = ('backend', 'deploy')
SKIP_DIRS = {'.git', 'node_modules', 'dist', 'build', 'coverage', '__pycache__'}
SKIP_FILES = {'.DS_Store'}
PROTECTED_REMOTE_FILES = {
    '/root/projects/eventapp/deploy/eventapp.vps.env',
}


def parse_args():
    parser = argparse.ArgumentParser(
        description='Safe non-destructive backend deploy for EventApp VPS.',
    )
    parser.add_argument('--host', default=os.environ.get('EVENTAPP_VPS_HOST', '66.94.101.47'))
    parser.add_argument('--user', default=os.environ.get('EVENTAPP_VPS_USER', 'root'))
    parser.add_argument('--password', default=os.environ.get('EVENTAPP_VPS_PASSWORD'))
    parser.add_argument('--remote-root', default=os.environ.get('EVENTAPP_VPS_REMOTE_ROOT', DEFAULT_REMOTE_ROOT))
    parser.add_argument('--local-root', default=os.environ.get('EVENTAPP_LOCAL_ROOT', DEFAULT_LOCAL_ROOT))
    parser.add_argument('--healthcheck-url', default=os.environ.get('EVENTAPP_HEALTHCHECK_URL', DEFAULT_HEALTHCHECK_URL))
    parser.add_argument('--dry-run', action='store_true', help='Show planned actions without uploading or rebuilding.')
    parser.add_argument(
        '--allow-dirty-remote-repo',
        action='store_true',
        help='Continue even if remote git status shows local changes. Safe deploy uses file sync, not git pull.',
    )
    return parser.parse_args()


def fail(message):
    print(f'[ERROR] {message}')
    sys.exit(1)


def info(message):
    print(f'[INFO] {message}')


def step(message):
    print(f'\n=== {message} ===')


def ensure_args(args):
    if not args.password:
        fail('Missing VPS password. Set EVENTAPP_VPS_PASSWORD or pass --password.')

    for folder in UPLOAD_DIRS:
        path = os.path.join(args.local_root, folder)
        if not os.path.isdir(path):
            fail(f'Missing local directory: {path}')


def connect_ssh(args):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(args.host, username=args.user, password=args.password, timeout=20)
    return client


def run_remote(client, command, timeout=240, allow_failure=False):
    stdin, stdout, stderr = client.exec_command(command, timeout=timeout)
    out = stdout.read().decode(errors='replace').strip()
    err = stderr.read().decode(errors='replace').strip()
    status = stdout.channel.recv_exit_status()

    if out:
        print(out)
    if err:
        print(err)

    if status != 0 and not allow_failure:
        fail(f'Remote command failed ({status}): {command}')

    return status, out, err


def ensure_remote_paths(client, remote_root):
    step('Checking remote project path')
    run_remote(client, f'ls {remote_root}')


def check_remote_git_status(client, remote_root, allow_dirty):
    step('Checking remote git status')
    _, out, _ = run_remote(client, f'cd {remote_root} && git status --short', allow_failure=True)
    dirty = bool(out.strip())

    if dirty:
        info('Remote repository has local changes.')
        if not allow_dirty:
            fail('Remote repo is dirty. Re-run with --allow-dirty-remote-repo to confirm you want file sync instead of git pull.')
    else:
        info('Remote repository is clean.')


def create_remote_backup(client, remote_root, dry_run):
    timestamp = dt.datetime.now().strftime('%Y%m%d%H%M%S')
    backup_path = f'/root/backups/eventapp_code_backup_{timestamp}.tar.gz'
    command = (
        'mkdir -p /root/backups && '
        f'tar -czf {backup_path} -C /root/projects eventapp/backend eventapp/deploy'
    )

    step('Creating remote code backup')
    info(f'Backup path: {backup_path}')
    if dry_run:
        info(f'[dry-run] {command}')
    else:
        run_remote(client, command, timeout=600)

    return backup_path


def ensure_sftp_dir(sftp, remote_path):
    current = ''
    for part in remote_path.strip('/').split('/'):
        current += '/' + part
        try:
            sftp.stat(current)
        except IOError:
            sftp.mkdir(current)


def iter_uploads(local_base, remote_base):
    for dirpath, dirnames, filenames in os.walk(local_base):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        rel_dir = os.path.relpath(dirpath, local_base)
        remote_dir = remote_base if rel_dir == '.' else posixpath.join(remote_base, rel_dir.replace('\\', '/'))
        yield ('dir', dirpath, remote_dir)

        for filename in filenames:
            if filename in SKIP_FILES:
                continue

            local_path = os.path.join(dirpath, filename)
            rel_file = os.path.relpath(local_path, local_base).replace('\\', '/')
            remote_path = posixpath.join(remote_base, rel_file)

            if remote_path in PROTECTED_REMOTE_FILES:
                continue

            if os.path.basename(local_path) == '.env':
                continue

            yield ('file', local_path, remote_path)


def sync_directories(client, args):
    step('Syncing backend and deploy directories')
    sftp = client.open_sftp()
    uploaded = []
    try:
        for folder in UPLOAD_DIRS:
            local_base = os.path.join(args.local_root, folder)
            remote_base = posixpath.join(args.remote_root, folder)

            for kind, source, target in iter_uploads(local_base, remote_base):
                if kind == 'dir':
                    if not args.dry_run:
                        ensure_sftp_dir(sftp, target)
                    continue

                info(f'Upload {source} -> {target}')
                uploaded.append(target)
                if not args.dry_run:
                    parent = posixpath.dirname(target)
                    ensure_sftp_dir(sftp, parent)
                    sftp.put(source, target)
    finally:
        sftp.close()

    info(f'Total files queued for upload: {len(uploaded)}')
    return uploaded


def rebuild_backend(client, args):
    step('Rebuilding backend container only')
    command = (
        f'cd {args.remote_root} && '
        'docker compose -f deploy/docker-compose.vps.yml --env-file deploy/eventapp.vps.env '
        'up -d --build eventapp-backend'
    )
    if args.dry_run:
        info(f'[dry-run] {command}')
        return

    run_remote(client, command, timeout=1200)


def validate_stack(client, args):
    step('Validating container status')
    ps_command = (
        f'cd {args.remote_root} && '
        'docker compose -f deploy/docker-compose.vps.yml --env-file deploy/eventapp.vps.env ps'
    )
    health_command = f'curl -k {args.healthcheck_url}'

    if args.dry_run:
        info(f'[dry-run] {ps_command}')
        info(f'[dry-run] {health_command}')
        return

    run_remote(client, ps_command, timeout=240)

    step('Validating public healthcheck')
    _, out, _ = run_remote(client, health_command, timeout=120)
    if '"status":"ok"' not in out:
        fail('Healthcheck did not return expected ok status.')


def print_summary(backup_path, uploaded, args):
    step('Summary')
    info(f'Dry run: {args.dry_run}')
    info(f'Remote root: {args.remote_root}')
    info(f'Backup: {backup_path}')
    info(f'Uploaded files: {len(uploaded)}')
    info('Database safety rules respected: no db:init, no truncate, no drop database, no restore.')


def main():
    args = parse_args()
    ensure_args(args)

    if not args.allow_dirty_remote_repo:
        info('Safe deploy requires explicit acknowledgement when the remote repo has local changes.')

    client = connect_ssh(args)
    try:
        ensure_remote_paths(client, args.remote_root)
        check_remote_git_status(client, args.remote_root, args.allow_dirty_remote_repo)
        backup_path = create_remote_backup(client, args.remote_root, args.dry_run)
        uploaded = sync_directories(client, args)
        rebuild_backend(client, args)
        validate_stack(client, args)
        print_summary(backup_path, uploaded, args)
    finally:
        client.close()


if __name__ == '__main__':
    main()
