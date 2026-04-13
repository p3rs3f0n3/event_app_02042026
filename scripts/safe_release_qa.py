import argparse
import os
import subprocess
import sys


ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


def fail(message):
    print(f'[ERROR] {message}')
    sys.exit(1)


def info(message):
    print(f'[INFO] {message}')


def step(message):
    print(f'\n=== {message} ===')


def run(command, dry_run=False):
    printable = ' '.join(command)
    if dry_run:
        info(f'[dry-run] {printable}')
        return

    result = subprocess.run(command, cwd=ROOT_DIR, text=True)
    if result.returncode != 0:
        fail(f'Command failed: {printable}')


def parse_args():
    parser = argparse.ArgumentParser(description='Safe QA release orchestrator for EventApp.')
    parser.add_argument('--skip-deploy', action='store_true')
    parser.add_argument('--skip-apk', action='store_true')
    parser.add_argument('--skip-update', action='store_true')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--allow-dirty-remote-repo', action='store_true')
    return parser.parse_args()


def main():
    args = parse_args()

    step('Safe QA release plan')
    info(f'Dry run: {args.dry_run}')
    info(f'Skip deploy: {args.skip_deploy}')
    info(f'Skip APK: {args.skip_apk}')
    info(f'Skip update: {args.skip_update}')

    if not args.skip_deploy:
        step('Backend safe deploy')
        command = ['python', 'scripts/safe_deploy_vps_backend.py']
        if args.dry_run:
            command.append('--dry-run')
        if args.allow_dirty_remote_repo:
            command.append('--allow-dirty-remote-repo')
        run(command, dry_run=args.dry_run)

    if not args.skip_apk:
        step('Safe Android APK build')
        command = ['python', 'scripts/safe_mobile_apk_build.py']
        if args.dry_run:
            command.append('--dry-run')
        run(command, dry_run=args.dry_run)

    if not args.skip_update:
        step('Safe EAS Update publish')
        command = ['python', 'scripts/safe_eas_update.py']
        if args.dry_run:
            command.append('--dry-run')
        run(command, dry_run=args.dry_run)

    step('Final reminder')
    info('This orchestrator only chains safe_* scripts.')
    info('If a task touches data, it is NOT a normal release and must use a separate approved procedure.')


if __name__ == '__main__':
    main()
