# Contexto local del proyecto Eventrix

## Resumen ejecutivo
- Proyecto full stack para gestión de eventos y activaciones publicitarias.
- Frontend mobile en Expo/React Native dentro de `mobile/`.
- Backend API en Node.js + Express dentro de `backend/`.
- Branding visible actualizado hoy de **EventApp** a **Eventrix** sin tocar identificadores sensibles (`slug`, `scheme`, `android.package`).

## Estructura del repo
- `mobile/` — app Expo/React Native.
  - `App.js` — entry principal, carga config remota y decide splash/login/home por rol.
  - `app.json` — configuración Expo; hoy solo se ajustó `expo.name` a `Eventrix`.
  - `src/api/api.js` — cliente axios y llamadas al backend.
  - `src/config/roles.js` — fallback local de nombre de app y roles.
  - `src/config/appMetadata.js` — NUEVO; centraliza branding visible y texto de términos.
  - `src/components/BrandMark.js` — marca visual principal del login/splash.
  - `src/components/EntrySplash.js` — splash de entrada.
  - `src/screens/LoginScreen.js` — login + gate legal post-login según estado persistido en backend.
  - `src/screens/*HomeScreen.js` — home por rol con fallback del nombre de app.
- `backend/` — API Express.
  - `server.js` — endpoint `/api/app-config`, auth y demás rutas.
  - `config/env.js` — defaults de entorno SMTP y config general.
  - `config/roles.js` — catálogo de roles devuelto al frontend.
- `documentacion/` — documentación operativa, deploy, QA y contexto histórico.

## Tecnologías detectadas
- Mobile: Expo 54, React 19, React Native 0.81, axios, lucide-react-native.
- Backend: Node.js CommonJS, Express 5, PostgreSQL (`pg`), Nodemailer.
- No se detectó `@react-native-async-storage/async-storage` en el proyecto al momento de este cambio; la persistencia de términos ahora depende del backend.

## Cambios realizados hoy
1. Se creó `mobile/src/config/appMetadata.js` para centralizar:
   - nombre visible `Eventrix`
   - leyenda exacta `by 360 Marketing Solutions S.A.S`
   - subtítulos de splash/login
   - texto completo de términos y condiciones
2. Se actualizó branding visible en:
   - `mobile/app.json` (`expo.name`)
   - `mobile/src/config/roles.js` fallback local
   - `backend/server.js` config remota `/api/app-config`
   - `mobile/src/components/BrandMark.js`
   - `mobile/src/components/EntrySplash.js`
   - `mobile/src/screens/LoginScreen.js`
   - fallbacks visibles en `AdminHomeScreen`, `ExecutiveHomeScreen`, `CoordinatorHomeScreen`, `ClientHomeScreen`
3. Se evolucionó el flujo de términos para que deje de ser solo en memoria y pase a persistirse por usuario:
   - `backend/db/01_schema.sql` agrega `users.terms_accepted` y `users.terms_accepted_at` con `IF NOT EXISTS`
   - `backend/db/02_seed.sql`, `backend/data/initialDb.js` y `backend/eventapp_db.json` inicializan esos campos para que no rompa ni Postgres ni el repositorio file-based
   - `backend/repositories/eventAppRepository.js` y `backend/repositories/postgresEventAppRepository.js` exponen y persisten aceptación de términos
   - `backend/server.js` ahora devuelve esos flags en `/api/login` y agrega `POST /api/terms/accept`
   - `mobile/src/api/api.js` incorpora `acceptTerms(userId)`
   - `mobile/src/screens/LoginScreen.js` hace login primero, y SOLO si el backend responde `termsAccepted = false` abre el modal legal y bloquea la entrada hasta registrar la aceptación
4. La aceptación ya NO queda en memoria local de la app: sobrevive a futuros logins porque la fuente de verdad pasó a backend/base de datos.

## Flujo de términos implementado
- El usuario ingresa credenciales normalmente.
- `/api/login` responde `termsAccepted` y `termsAcceptedAt` junto con el perfil.
- Si `termsAccepted = true`, entra directo a la app y el modal legal no vuelve a mostrarse.
- Si `termsAccepted = false`, `LoginScreen` NO continúa al home: abre el modal con el texto legal completo y exige confirmación.
- Al tocar “Aceptar términos”, mobile llama `POST /api/terms/accept` con `userId`.
- Solo si backend confirma la persistencia se ejecuta `onLogin`; si falla, se informa al usuario y la cuenta sigue bloqueada como no aceptada.

## Riesgos / gotchas
- Como no hay auth real/token, la aceptación se registra con `userId` validado contra existencia + estado activo, consistente con la arquitectura actual pero NO equivalente a autenticación fuerte.
- El repositorio file-based normaliza y regraba `eventapp_db.json` al cargar para migrar usuarios viejos sin esos campos.
- `slug`, `scheme` y `android.package` siguen con `eventapp` / `com.eventapp.mobile`; esto fue deliberado para no romper Expo/EAS/deep links.
- Hay documentación histórica y nombres internos de repositorio/clases con `EventApp`; no se tocaron porque no impactan branding visible inmediato y podrían afectar referencias existentes.

## Archivos clave para próximas sesiones
- `mobile/src/screens/LoginScreen.js` — gate legal post-login; si más adelante agregan auth real, este flujo debería dejar de confiar en `userId` plano.
- `mobile/src/config/appMetadata.js` — fuente de verdad de branding y términos.
- `backend/server.js` — login, aceptación de términos y branding remoto.
- `backend/repositories/eventAppRepository.js` y `backend/repositories/postgresEventAppRepository.js` — persistencia dual de aceptación de términos.
- `mobile/app.json` — nombre visible Expo, pero con identificadores sensibles intactos.

## Validación realizada hoy
- Revisión estática + chequeo de sintaxis JS con `node --check` sobre archivos modificados del backend.
- En mobile se hizo revisión estática/manual del flujo porque `LoginScreen.js` contiene JSX y no pasa por `node --check` sin toolchain adicional.
- No se ejecutó build, por pedido explícito.
