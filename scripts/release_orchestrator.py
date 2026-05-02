import argparse
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
VPS_ORCHESTRATOR = PROJECT_ROOT / 'scripts' / 'vps_deploy_orchestrator.py'
APK_ORCHESTRATOR = PROJECT_ROOT / 'scripts' / 'mobile_apk_orchestrator.py'


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
    parser = argparse.ArgumentParser(description='Orquestador único de release para EventApp.')
    parser.add_argument('--skip-vps', action='store_true', help='Saltea el deploy a la VPS.')
    parser.add_argument('--skip-apk', action='store_true', help='Saltea el build APK.')
    parser.add_argument('--skip-dry-run', action='store_true', help='Saltea los dry-runs previos en ambos flujos.')
    return parser.parse_args()


def ensure_script(path):
    if not path.exists():
        fail(f'No se encontró el script base: {path}')


def main():
    args = parse_args()
    ensure_script(VPS_ORCHESTRATOR)
    ensure_script(APK_ORCHESTRATOR)

    info('Orquestador unificado listo.')

    if not args.skip_vps:
        vps_cmd = [sys.executable, str(VPS_ORCHESTRATOR)]
        if args.skip_dry_run:
            vps_cmd.append('--skip-dry-run')
        run_step(vps_cmd)

    if not args.skip_apk:
        apk_cmd = [sys.executable, str(APK_ORCHESTRATOR)]
        if args.skip_dry_run:
            apk_cmd.append('--skip-dry-run')
        run_step(apk_cmd)

    info('Release unificado completado correctamente.')


if __name__ == '__main__':
    main()
