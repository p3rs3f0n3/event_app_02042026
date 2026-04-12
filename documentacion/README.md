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

Reset operativo recomendado:

```bash
npm run db:init
```

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

Si necesitás cambiar la URL del backend en mobile, configurala con el host disponible en tu entorno, por ejemplo:

```txt
http://192.168.20.35:3001/api
```

## Estado actual

- Flujo principal del rol ejecutivo
- Creación y revisión de eventos
- Disponibilidad de coordinadores y personal por ciudad/horario
- Inactivación automática y manual de eventos
