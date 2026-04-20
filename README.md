# GpsRastreo

GpsRastreo es la nueva identidad visual y funcional del proyecto de rastreo satelital conectado a la plataforma viva en `https://rastreo.soportecni.com`.

## Estado actual

La base actual ya funciona como app movil incremental de operacion sobre el stack existente:

- login y sessionId contra backend proxy
- mapa Leaflet con vista general, enfoque por evento y clusters por zoom
- eventos recientes con navegacion al mapa
- dispositivos con accesos a mapa e historico
- historico/rutas con presets moviles y contexto por unidad
- empaquetado con Capacitor sin migrar de stack

## Estructura

- `src/`: interfaz inicial web en HTML, CSS y JavaScript
- `assets/`: iconos y recursos visuales
- `scripts/`: utilidades para empaquetado y automatizacion local
- `www/`: salida web lista para Capacitor
- `docs/`: arquitectura y notas del producto

## Archivos principales

- `src/index.html`
- `src/login.html`
- `src/dashboard.html`
- `src/styles.css`
- `src/app.js`
- `src/config.js`
- `src/mock-data.js`
- `src/api.js`
- `src/runtime.js`
- `assets/icono.png`
- `docs/arquitectura.md`
- `docs/integracion-backend.md`
- `docs/mapa-plataforma-real.md`
- `docs/capacitor-setup.md`

## API de referencia

- Plataforma viva: `https://rastreo.soportecni.com`
- Backend local sugerido: `http://localhost:4100/api`
- Titulo detectado: `Iniciar sesión - Soportecni GPS`
- Enfoque funcional observado: login, acceso a sistema de rastreo satelital y operacion en español
- Estado de integracion actual: frontend vanilla acoplado a un backend proxy que puede operar en modo mock o live sin cambiar el contrato de la UI
- Flujo ya cubierto en backend: `health`, `login`, `sessionId`, `monitor`, `eventos recientes`, `alertas` y `ruta basica`

## Backend local

Desde `C:\AppSoportecni\backend`:

1. `npm run dev` para levantar el proxy local
2. `npm test` para correr las pruebas smoke del contrato mock

## Login real y sesion

- `src/login.html` envia credenciales solo al backend proxy local
- `backend/src/routes/auth.js` obtiene el token antifalsificacion y autentica contra `https://rastreo.soportecni.com`
- el backend guarda las cookies reales del portal y crea una `sessionId` interna
- `src/api.js` persiste esa `sessionId` y la reutiliza entre pantallas
- si la sesion expira o el portal ya no acepta las cookies, el frontend limpia el estado operativo y vuelve a `login.html`

Las pruebas actuales validan el contrato base de:

- raiz `/`
- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/auth/session/:id`
- `GET /api/auth/latest-session`
- `GET /api/live/monitor/data`
- `GET /api/live/alerts/list`
- `GET /api/live/monitor/events/recent`
- `GET /api/live/monitor/route`

## Proximo paso recomendado

Construir la siguiente fase sobre esta base:

1. validar payloads reales del portal para eventos y rutas sobre cuentas productivas
2. endurecer mas los estados de sesion expirada con reintento y relogin guiado
3. seguir afinando paneles operativos de mapa y detalle por unidad
4. ampliar cobertura funcional sin migrar el stack actual

## Salto a movil

La base ya quedo preparada para empaquetarse con `Capacitor`:

1. instalar dependencias en la raiz del proyecto
2. generar `www/` con `npm run build:web`
3. sincronizar con Android/iPhone usando `Capacitor`
