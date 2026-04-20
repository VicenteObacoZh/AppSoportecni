# Integracion Backend de GpsRastreo

## Estado actual

La interfaz ya quedo preparada con una capa de integracion simple en frontend:

- `src/config.js`: configuracion central del proyecto
- `src/mock-data.js`: datos demo estructurados
- `src/api.js`: cliente API desacoplado de la UI
- `src/runtime.js`: consumo de servicios y renderizado
- `backend/`: proxy local para evolucionar hacia integracion real

## Enfoque actual

La fuente de verdad para `mock` vs `live` es el backend de `backend/`.

- el frontend ya no debe inventar contratos aparte
- `src/api.js` consume el mismo flujo tanto en mock como en live
- el modo real se refleja desde `GET /api/health` y desde las respuestas de sesion/login

## Flujo alineado hoy

1. `GET /api/health`
2. `POST /api/auth/login`
3. guardar `sessionId`
4. `GET /api/auth/session/:id`
5. `GET /api/live/monitor/data?sessionId=...`
6. `GET /api/live/alerts/list?sessionId=...`
7. `GET /api/live/monitor/route?...`

## Riesgos actuales

- la plataforma `https://rastreo.soportecni.com` responde en vivo
- desde navegador puede existir restriccion de CORS
- el login real probablemente requiere token antifalsificacion y flujo de sesion de servidor

## Camino seguro

La integracion real deberia pasar por una de estas rutas:

- backend propio que consuma la plataforma y exponga endpoints seguros al frontend
- proxy autenticado que maneje cookies, tokens y cabeceras del sistema real

## Proxima fase tecnica

1. endurecer manejo de sesion expirada y re-login
2. ampliar handlers del portal real sin romper contratos actuales
3. agregar pruebas de humo para health, login y monitor
4. documentar estrategia Android (`http://localhost` + `adb reverse`)
