# EventApp

Aplicación de gestión de eventos con backend en Node.js/Express + PostgreSQL y cliente móvil en Expo/React Native.

## Estructura

- `backend/` API REST, repositorios file/PostgreSQL y scripts de inicialización.
- `mobile/` aplicación móvil enfocada hoy en el flujo del ejecutivo.
- `documentacion/` documentación funcional y material de diseño.

## Requisitos

- Node.js
- PostgreSQL
- Expo CLI / Expo Go para probar mobile

## Backend

Desde `backend/`:

```bash
npm install
npm run db:init
npm run dev
```

Reset local de desarrollo solamente:

```bash
npm run db:init
```

IMPORTANTE:

- `npm run db:init` es para entornos locales o bases descartables.
- NO usar `npm run db:init` en la VPS ni en una base con informacion que se deba preservar.
- En la VPS, el deploy normal consiste en sincronizar codigo y reconstruir solo `eventapp-backend`.
- Para la operacion real de la VPS, ver `documentacion/MANUAL_DEPLOY_VPS_EVENTAPP.txt`.
- Flujo recomendado de deploy seguro: `python scripts/safe_deploy_vps_backend.py --allow-dirty-remote-repo`

Scripts y acciones peligrosas fuera de desarrollo local:

- `backend/scripts/init-postgres.js` -> aplica schema y seed.
- `scripts/deploy_vps_terms_fix.py` -> ejecuta `db:init` en la VPS.
- `scripts/restore_vps_from_backup_and_migrate_terms.py` -> contiene `DROP DATABASE`.

Si el entorno tiene datos reales, esos flujos NO son de deploy normal.

Barreras técnicas nuevas:

- `npm run db:init` falla por defecto si no se define confirmación explícita por variables de entorno.
- `scripts/deploy_vps_terms_fix.py` falla por defecto si no se pasa flag + variable de entorno.
- `scripts/restore_vps_from_backup_and_migrate_terms.py` falla por defecto si no se pasa flag + variable de entorno.

Usuarios sugeridos para pruebas funcionales:

- Ejecutivo 1: `ejecutivo.ana` / `Funcional.EventApp.2026`
- Ejecutivo 2: `ejecutivo.bruno` / `Funcional.EventApp.2026`
- Coordinador: `coord` / `Funcional.EventApp.2026`
- Clientes: `cliente.alpina`, `cliente.colcafe`, `cliente.nutresa` / `Funcional.EventApp.2026`

## Mobile

Desde `mobile/`:

```bash
npm install
npx expo start
```

Flujo recomendado para APK seguro:

```powershell
python scripts/safe_mobile_apk_build.py --dry-run
python scripts/safe_mobile_apk_build.py
```

Flujo recomendado para EAS Update seguro:

```powershell
python scripts/safe_eas_update.py --dry-run
python scripts/safe_eas_update.py
```

Flujo recomendado para release QA completo:

```powershell
$env:EVENTAPP_VPS_PASSWORD='tu_password'
python scripts/safe_release_qa.py --dry-run --allow-dirty-remote-repo
python scripts/safe_release_qa.py --allow-dirty-remote-repo
```

Si necesitás cambiar la URL del backend en mobile, configurala con el host disponible en tu entorno, por ejemplo:

```txt
http://192.168.20.35:3001/api
```

## Estado actual

- Flujo principal del rol ejecutivo
- Creación y revisión de eventos
- Disponibilidad de coordinadores y personal por ciudad/horario
- Inactivación automática y manual de eventos
