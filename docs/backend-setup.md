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
- `GET /api/dashboard`
- `GET /api/live/monitor/data?sessionId=...`

## Como iniciar

1. Entrar a `C:\AppSoportecni\backend`
2. Crear un archivo `.env` basado en `.env.example`
3. Instalar dependencias con `npm install`
4. Ejecutar `npm run dev`

## Estado actual

- `MOCK_MODE=true`: responde con datos demo y valida estructura
- `MOCK_MODE=false`: valida plataforma viva y ya intenta obtener token antifalsificacion + sesion de login

## Siguiente paso real

1. capturar el flujo de login real
2. manejar cookies y token antifalsificacion
3. exponer endpoints propios para frontend
4. conectar dashboard, alertas y mapa
