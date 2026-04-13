# SAFE OPERATIONS - EVENTAPP

Este documento define los UNICOS caminos recomendados para operaciones sensibles.

## Regla principal

- Si existe un script `safe_*`, ese es el camino correcto.
- No improvisar comandos destructivos.
- No ejecutar scripts peligrosos sin entenderlos completos.

## 1) Deploy seguro del backend a VPS

Script recomendado:

```powershell
$env:EVENTAPP_VPS_PASSWORD='tu_password'
python scripts/safe_deploy_vps_backend.py --dry-run --allow-dirty-remote-repo
python scripts/safe_deploy_vps_backend.py --allow-dirty-remote-repo
```

Qué hace:
- verifica ruta remota
- revisa estado git remoto
- genera backup remoto en `/root/backups/`
- sincroniza `backend/` y `deploy/`
- NO sobrescribe `deploy/eventapp.vps.env`
- rebuild solo de `eventapp-backend`
- valida `docker compose ps`
- valida healthcheck público

Qué NO hace:
- no hace `git pull`
- no ejecuta `npm run db:init`
- no hace `TRUNCATE`
- no hace `DROP DATABASE`
- no restaura backups

## 2) Build seguro de APK Android

Script recomendado:

```powershell
python scripts/safe_mobile_apk_build.py --dry-run
python scripts/safe_mobile_apk_build.py
```

Qué valida:
- `mobile/app.json` existe
- `mobile/eas.json` existe
- owner Expo esperado: `mojarras`
- `expo.extra.eas.projectId` presente
- `expo.updates.url` presente
- perfil `preview` existe
- `preview` apunta a `https://66.94.101.47.sslip.io/api`
- `preview` genera `apk`
- `npx eas whoami` coincide con la cuenta esperada

Qué configura:
- `EXPO_PUBLIC_API_URL`
- `CI=1`
- `EAS_SKIP_AUTO_FINGERPRINT=1`

## 3) EAS Update seguro

Script recomendado:

```powershell
python scripts/safe_eas_update.py --dry-run
python scripts/safe_eas_update.py
```

Qué valida:
- owner Expo esperado
- `projectId`
- `updates.url`
- `runtimeVersion`
- branch/channel de QA
- autenticación `npx eas whoami`
- API URL correcta antes de publicar

## 4) Orquestador seguro para QA release

Script recomendado:

```powershell
$env:EVENTAPP_VPS_PASSWORD='tu_password'
python scripts/safe_release_qa.py --dry-run --allow-dirty-remote-repo
python scripts/safe_release_qa.py --allow-dirty-remote-repo
```

Qué hace:
- encadena `safe_deploy_vps_backend.py`
- encadena `safe_mobile_apk_build.py`
- encadena `safe_eas_update.py`
- permite saltar pasos con flags `--skip-*`
- obliga a usar solo flujos `safe_*`

## 5) Operaciones prohibidas en deploy normal

- `npm run db:init` en VPS con datos reales
- `scripts/deploy_vps_terms_fix.py`
- `scripts/restore_vps_from_backup_and_migrate_terms.py`
- cualquier `TRUNCATE`, `DROP DATABASE`, restore completo o seed sobre base real

## 6) Si una tarea toca datos

Ya NO es deploy normal.

Requiere:
- backup nuevo
- validación manual
- aprobación explícita
- procedimiento documentado

## 7) Orden recomendado cuando alguien pida “deploy y apk”

1. `python scripts/safe_release_qa.py --dry-run --allow-dirty-remote-repo`
2. `python scripts/safe_release_qa.py --allow-dirty-remote-repo`
3. compartir URL del APK
4. compartir resultado del EAS Update

## 8) Documentos base

- `documentacion/MANUAL_DEPLOY_VPS_EVENTAPP.txt`
- `documentacion/MANUAL_EXPO_GO_EVENTAPP.txt`
- `documentacion/Datos VPS.txt`
- `documentacion/README.md`
