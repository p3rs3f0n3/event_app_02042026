import argparse
import os
import re
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SAFE_DEPLOY_SCRIPT = PROJECT_ROOT / 'scripts' / 'safe_deploy_vps_backend.py'
VPS_DOC = PROJECT_ROOT / 'documentacion' / 'Datos VPS.txt'


def fail(message, code=1):
    print(f'[ERROR] {message}')
    raise SystemExit(code)


def info(message):
    print(f'[INFO] {message}')


def load_vps_credentials():
    host = os.environ.get('EVENTAPP_VPS_HOST')
    user = os.environ.get('EVENTAPP_VPS_USER')
    password = os.environ.get('EVENTAPP_VPS_PASSWORD')

    if host and user and password:
        return host, user, password

    if not VPS_DOC.exists():
        fail(f'No se encontró {VPS_DOC}')

    content = VPS_DOC.read_text(encoding='utf-8', errors='replace')

    if not host:
        host_match = re.search(r'ssh\s+root@(?P<host>[0-9A-Za-z.:-]+)\s+-->', content, re.IGNORECASE)
        host = host_match.group('host') if host_match else '66.94.101.47'

    if not user:
        user = 'root'

    if not password:
        password_match = re.search(r'ssh\s+root@(?P<host>[0-9A-Za-z.:-]+)\s+-->\s+(?P<password>\S+)', content, re.IGNORECASE)
        if password_match:
            password = password_match.group('password')

    if not password:
        fail('No se pudo resolver la contraseña SSH de la VPS. Seteá EVENTAPP_VPS_PASSWORD o revisá documentacion/Datos VPS.txt')

    return host, user, password


def run_step(command, env):
    printable = ' '.join(command)
    info(f'Ejecutando: {printable}')
    result = subprocess.run(command, cwd=str(PROJECT_ROOT), env=env)
    if result.returncode != 0:
        fail(f'Fallo el paso: {printable}', result.returncode)


def parse_args():
    parser = argparse.ArgumentParser(description='Orquestador automático de deploy a la VPS de EventApp.')
    parser.add_argument('--skip-dry-run', action='store_true', help='Saltea la ejecución previa en modo simulación.')
    return parser.parse_args()


def main():
    args = parse_args()
    if not SAFE_DEPLOY_SCRIPT.exists():
        fail(f'No se encontró el script base: {SAFE_DEPLOY_SCRIPT}')

    host, user, password = load_vps_credentials()
    env = os.environ.copy()
    env['EVENTAPP_VPS_HOST'] = host
    env['EVENTAPP_VPS_USER'] = user
    env['EVENTAPP_VPS_PASSWORD'] = password

    info('Orquestador listo. Se usará el flujo seguro de backend.')

    if not args.skip_dry_run:
        run_step([
            sys.executable,
            str(SAFE_DEPLOY_SCRIPT),
            '--dry-run',
            '--allow-dirty-remote-repo',
        ], env)

    run_step([
        sys.executable,
        str(SAFE_DEPLOY_SCRIPT),
        '--allow-dirty-remote-repo',
    ], env)

    info('Deploy completado correctamente.')


if __name__ == '__main__':
    main()
