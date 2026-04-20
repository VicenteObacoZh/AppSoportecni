# Backend Setup de GpsRastreo

## Objetivo

Este backend actua como un proxy seguro entre la interfaz web y la plataforma real `https://rastreo.soportecni.com`.

## Estructura

- `backend/package.json`
- `backend/.env.example`
- `backend/src/server.js`
- `backend/src/config.js`
- `backend/src/routes/health.js`
- `backend/src/routes/auth.js`
- `backend/src/routes/dashboard.js`
- `backend/src/services/platformClient.js`
- `backend/src/data/mockDashboard.js`

## Endpoints iniciales

- `GET /api/health`
- `GET /api/auth/login-page`
- `POST /api/auth/login`
- `GET /api/auth/session/:id`
- `GET /api/auth/latest-session`
- `GET /api/dashboard`
- `GET /api/live/monitor/data?sessionId=...`
- `GET /api/live/monitor/events/recent?sessionId=...&limit=...`
- `GET /api/live/alerts/list?sessionId=...`
- `GET /api/live/monitor/route?sessionId=...&deviceId=...&from=...&to=...`

## Como iniciar

1. Entrar a `C:\AppSoportecni\backend`
2. Crear un archivo `.env` basado en `.env.example`
3. Instalar dependencias con `npm install`
4. Ejecutar `npm run dev`
5. Ejecutar `npm test` para validar el contrato mock del backend sin depender del portal real

## Estado actual

- `MOCK_MODE=true`: el backend mantiene el contrato completo de login + sessionId + monitor + alertas + ruta con datos simulados
- `MOCK_MODE=false`: el backend valida plataforma viva, obtiene token antifalsificacion y crea una sesion local con cookies del portal
- `SESSION_TTL_MINUTES`: controla la expiracion de las sesiones locales en memoria del backend

## Siguiente paso real

1. fortalecer expiracion y renovacion de sesiones reales
2. ampliar cobertura sobre handlers reales del portal
3. mantener frontend consumiendo solo el backend proxy
4. documentar pruebas de Android/Capacitor con backend local
