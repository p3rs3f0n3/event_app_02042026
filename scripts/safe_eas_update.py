import argparse
import json
import os
import subprocess
import sys


DEFAULT_MOBILE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'mobile'))
DEFAULT_API_URL = 'https://66.94.101.47.sslip.io/api'
DEFAULT_ACCOUNT = 'mojarras'
DEFAULT_BRANCH = 'phase-1'
DEFAULT_CHANNEL = 'phase-1'
DEFAULT_MESSAGE = 'Phase 1 QA update'


def fail(message):
    print(f'[ERROR] {message}')
    sys.exit(1)


def info(message):
    print(f'[INFO] {message}')


def step(message):
    print(f'\n=== {message} ===')


def run(command, cwd, env=None, dry_run=False):
    printable = ' '.join(command)
    if dry_run:
        info(f'[dry-run] {printable}')
        return ''

    result = subprocess.run(command, cwd=cwd, env=env, text=True, capture_output=True)
    if result.stdout:
        print(result.stdout.strip())
    if result.stderr:
        print(result.stderr.strip())
    if result.returncode != 0:
        fail(f'Command failed: {printable}')
    return result.stdout.strip()


def parse_args():
    parser = argparse.ArgumentParser(description='Safe EAS Update runner for EventApp mobile.')
    parser.add_argument('--mobile-dir', default=os.environ.get('EVENTAPP_MOBILE_DIR', DEFAULT_MOBILE_DIR))
    parser.add_argument('--api-url', default=os.environ.get('EVENTAPP_MOBILE_API_URL', DEFAULT_API_URL))
    parser.add_argument('--expected-account', default=os.environ.get('EVENTAPP_EAS_ACCOUNT', DEFAULT_ACCOUNT))
    parser.add_argument('--branch', default=os.environ.get('EVENTAPP_EAS_BRANCH', DEFAULT_BRANCH))
    parser.add_argument('--channel', default=os.environ.get('EVENTAPP_EAS_CHANNEL', DEFAULT_CHANNEL))
    parser.add_argument('--message', default=os.environ.get('EVENTAPP_EAS_UPDATE_MESSAGE', DEFAULT_MESSAGE))
    parser.add_argument('--dry-run', action='store_true')
    return parser.parse_args()


def ensure_files(args):
    for path in ('app.json', 'eas.json', 'package.json'):
        full = os.path.join(args.mobile_dir, path)
        if not os.path.isfile(full):
            fail(f'Missing required mobile file: {full}')


def read_json(path):
    with open(path, 'r', encoding='utf-8') as file:
        return json.load(file)


def verify_config(args):
    step('Verifying mobile configuration for EAS Update')
    app_json = read_json(os.path.join(args.mobile_dir, 'app.json'))
    eas_json = read_json(os.path.join(args.mobile_dir, 'eas.json'))

    expo = app_json.get('expo', {})
    owner = expo.get('owner')
    project_id = expo.get('extra', {}).get('eas', {}).get('projectId')
    updates_url = expo.get('updates', {}).get('url')
    runtime_version = expo.get('runtimeVersion', {})
    preview_profile = eas_json.get('build', {}).get('preview')

    if owner != args.expected_account:
        fail(f'Unexpected Expo owner. Expected {args.expected_account}, got {owner}.')
    if not project_id:
        fail('Missing expo.extra.eas.projectId in app.json.')
    if not updates_url:
        fail('Missing expo.updates.url in app.json.')
    if not runtime_version:
        fail('Missing expo.runtimeVersion in app.json.')
    if not preview_profile:
        fail('Missing preview build profile in eas.json.')

    profile_api_url = preview_profile.get('env', {}).get('EXPO_PUBLIC_API_URL')
    if profile_api_url != args.api_url:
        fail(f'Preview profile points to `{profile_api_url}`, expected `{args.api_url}`.')

    info(f'Owner OK: {owner}')
    info(f'Project ID OK: {project_id}')
    info(f'Runtime version OK: {runtime_version}')
    info(f'Preview API URL OK: {profile_api_url}')


def verify_whoami(args, env):
    step('Verifying Expo/EAS authentication')
    output = run(['npx', 'eas', 'whoami'], cwd=args.mobile_dir, env=env, dry_run=args.dry_run)
    if args.dry_run:
        return
    if args.expected_account not in output:
        fail(f'EAS authenticated account mismatch. Expected output to contain `{args.expected_account}`.')


def verify_branch_and_channel(args, env):
    step('Verifying branch and channel')
    run(['npx', 'eas', 'branch:list', '--json'], cwd=args.mobile_dir, env=env, dry_run=args.dry_run)
    run(['npx', 'eas', 'channel:list', '--json'], cwd=args.mobile_dir, env=env, dry_run=args.dry_run)


def publish_update(args, env):
    step('Publishing safe EAS Update')
    command = [
        'npx', 'eas', 'update',
        '--branch', args.branch,
        '--message', args.message,
        '--json',
    ]
    return run(command, cwd=args.mobile_dir, env=env, dry_run=args.dry_run)


def verify_recent_updates(args, env):
    step('Verifying recent updates')
    run(['npx', 'eas', 'update:list', '--branch', args.branch, '--limit', '5', '--json'], cwd=args.mobile_dir, env=env, dry_run=args.dry_run)


def main():
    args = parse_args()
    ensure_files(args)
    verify_config(args)

    env = os.environ.copy()
    env['EXPO_PUBLIC_API_URL'] = args.api_url
    env['CI'] = '1'
    env['EAS_SKIP_AUTO_FINGERPRINT'] = '1'

    verify_whoami(args, env)
    verify_branch_and_channel(args, env)
    output = publish_update(args, env)
    verify_recent_updates(args, env)

    step('Summary')
    info(f'Dry run: {args.dry_run}')
    info(f'Branch: {args.branch}')
    info(f'Channel expectation: {args.channel}')
    info(f'API URL: {args.api_url}')
    if output and not args.dry_run:
        info('EAS Update completed. Review JSON output above for update group details.')


if __name__ == '__main__':
    main()
