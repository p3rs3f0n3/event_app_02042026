import argparse
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SAFE_APK_SCRIPT = PROJECT_ROOT / 'scripts' / 'safe_mobile_apk_build.py'


def fail(message, code=1):
    print(f'[ERROR] {message}')
    raise SystemExit(code)


def info(message):
    print(f'[INFO] {message}')


def run_step(command):
    printable = ' '.join(command)
    info(f'Ejecutando: {printable}')
    result = subprocess.run(command, cwd=str(PROJECT_ROOT))
    if result.returncode != 0:
        fail(f'Fallo el paso: {printable}', result.returncode)


def parse_args():
    parser = argparse.ArgumentParser(description='Orquestador automático de APK/EAS para EventApp.')
    parser.add_argument('--skip-dry-run', action='store_true', help='Saltea la ejecución previa en modo simulación.')
    return parser.parse_args()


def main():
    args = parse_args()
    if not SAFE_APK_SCRIPT.exists():
        fail(f'No se encontró el script base: {SAFE_APK_SCRIPT}')

    info('Orquestador APK listo. Se usará el flujo seguro de build.')

    if not args.skip_dry_run:
        run_step([sys.executable, str(SAFE_APK_SCRIPT), '--dry-run'])

    run_step([sys.executable, str(SAFE_APK_SCRIPT)])

    info('Build APK completado correctamente.')


if __name__ == '__main__':
    main()
