import argparse
import json
import os
import subprocess
import sys


DEFAULT_MOBILE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'mobile'))
DEFAULT_API_URL = 'https://66.94.101.47.sslip.io/api'
DEFAULT_PROFILE = 'preview'
DEFAULT_ACCOUNT = 'mojarras'


def fail(message):
    print(f'[ERROR] {message}')
    sys.exit(1)


def info(message):
    print(f'[INFO] {message}')


def step(message):
    print(f'\n=== {message} ===')


def normalize_command(command):
    if os.name == 'nt' and command and command[0] == 'npx':
        return ['npx.cmd', *command[1:]]
    return command


def run(command, cwd, env=None, dry_run=False):
    command = normalize_command(command)
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
    parser = argparse.ArgumentParser(description='Safe APK build runner for EventApp mobile.')
    parser.add_argument('--mobile-dir', default=os.environ.get('EVENTAPP_MOBILE_DIR', DEFAULT_MOBILE_DIR))
    parser.add_argument('--profile', default=os.environ.get('EVENTAPP_EAS_PROFILE', DEFAULT_PROFILE))
    parser.add_argument('--api-url', default=os.environ.get('EVENTAPP_MOBILE_API_URL', DEFAULT_API_URL))
    parser.add_argument('--expected-account', default=os.environ.get('EVENTAPP_EAS_ACCOUNT', DEFAULT_ACCOUNT))
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
    step('Verifying mobile configuration')
    app_json = read_json(os.path.join(args.mobile_dir, 'app.json'))
    eas_json = read_json(os.path.join(args.mobile_dir, 'eas.json'))

    expo = app_json.get('expo', {})
    owner = expo.get('owner')
    project_id = expo.get('extra', {}).get('eas', {}).get('projectId')
    updates_url = expo.get('updates', {}).get('url')
    profile = eas_json.get('build', {}).get(args.profile)

    if owner != args.expected_account:
        fail(f'Unexpected Expo owner. Expected {args.expected_account}, got {owner}.')
    if not project_id:
        fail('Missing expo.extra.eas.projectId in app.json.')
    if not updates_url:
        fail('Missing expo.updates.url in app.json.')
    if not profile:
        fail(f'Missing build profile `{args.profile}` in eas.json.')

    profile_api_url = profile.get('env', {}).get('EXPO_PUBLIC_API_URL')
    if profile_api_url != args.api_url:
        fail(f'Profile `{args.profile}` points to `{profile_api_url}`, expected `{args.api_url}`.')

    build_type = profile.get('android', {}).get('buildType')
    if args.profile == 'preview' and build_type != 'apk':
        fail('Preview profile must generate an APK (`android.buildType=apk`).')

    info(f'Owner OK: {owner}')
    info(f'Project ID OK: {project_id}')
    info(f'Profile `{args.profile}` API URL OK: {profile_api_url}')


def verify_whoami(args, env):
    step('Verifying Expo/EAS authentication')
    output = run(['npx', 'eas', 'whoami'], cwd=args.mobile_dir, env=env, dry_run=args.dry_run)
    if args.dry_run:
        return
    if args.expected_account not in output:
        fail(f'EAS authenticated account mismatch. Expected output to contain `{args.expected_account}`.')


def build_apk(args, env):
    step('Starting safe APK build')
    command = ['npx', 'eas', 'build', '--platform', 'android', '--profile', args.profile, '--non-interactive', '--json']
    return run(command, cwd=args.mobile_dir, env=env, dry_run=args.dry_run)


def main():
    args = parse_args()
    ensure_files(args)
    verify_config(args)

    env = os.environ.copy()
    env['EXPO_PUBLIC_API_URL'] = args.api_url
    env['CI'] = '1'
    env['EAS_SKIP_AUTO_FINGERPRINT'] = '1'

    verify_whoami(args, env)
    output = build_apk(args, env)

    step('Summary')
    info(f'Dry run: {args.dry_run}')
    info(f'Mobile dir: {args.mobile_dir}')
    info(f'Profile: {args.profile}')
    info(f'API URL: {args.api_url}')
    if output and not args.dry_run:
        info('APK build completed. Review JSON output above for artifact URL.')


if __name__ == '__main__':
    main()
