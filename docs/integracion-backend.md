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
7. `GET /api/live/monitor/events/recent?sessionId=...`
8. `GET /api/live/monitor/route?...`
9. `GET /api/live/monitor/geofences?sessionId=...`

## Pantallas y endpoints

- `src/login.html`
  - `POST /api/auth/login`
  - `GET /api/auth/latest-session`
- `src/map.html`
  - `GET /api/auth/session/:id`
  - `GET /api/live/monitor/data`
  - `GET /api/live/alerts/list`
  - `GET /api/live/monitor/geofences`
- `src/alerts.html`
  - `GET /api/auth/session/:id`
  - `GET /api/live/monitor/events/recent`
- `src/devices.html`
  - `GET /api/auth/session/:id`
  - `GET /api/live/monitor/data`
- `src/routes.html`
  - `GET /api/auth/session/:id`
  - `GET /api/live/monitor/data`
  - `GET /api/live/monitor/route`
  - playback local sobre los puntos ya normalizados por backend

## Flujo manual recomendado

1. iniciar backend con `npm run dev` en `backend/`
2. abrir `login.html`
3. autenticar contra el portal real
4. verificar que el frontend guarde `sessionId`
5. abrir `map.html` y confirmar carga de unidades
6. tocar una unidad para abrir detalle operativo
7. abrir `devices.html` y navegar a mapa o historico
8. abrir `alerts.html` y navegar de evento a mapa
9. abrir `routes.html`, consultar una ruta y probar reproducir, pausar, reiniciar y saltar a puntos de la timeline
10. forzar expiracion o borrar sesion para confirmar retorno limpio a `login.html`

## Riesgos actuales

- la plataforma `https://rastreo.soportecni.com` responde en vivo
- desde navegador puede existir restriccion de CORS
- el login real probablemente requiere token antifalsificacion y flujo de sesion de servidor
- los handlers reales de eventos y rutas pueden variar el payload y requerir mas normalizacion en backend

## Camino seguro

La integracion real deberia pasar por una de estas rutas:

- backend propio que consuma la plataforma y exponga endpoints seguros al frontend
- proxy autenticado que maneje cookies, tokens y cabeceras del sistema real

## Proxima fase tecnica

1. validar en vivo los payloads reales de `Events`, `Route` y el futuro handler de geocercas
2. reforzar re-login guiado cuando el portal invalida cookies
3. seguir ampliando pruebas smoke del backend y recorridos manuales de Android
4. mantener frontend consumiendo solo el proxy actual
