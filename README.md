# GpsRastreo

GpsRastreo es la nueva identidad visual y funcional del proyecto de rastreo satelital conectado a la plataforma viva en `https://rastreo.soportecni.com`.

## Estado actual

Se dejo una primera base visual del producto con enfoque en:

- monitoreo satelital
- panel operativo moderno
- modulos principales del sistema
- branding inicial con iconografia espacial y GPS

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
- Estado de integracion actual: capa frontend preparada con modo demo y cliente API desacoplado

## Proximo paso recomendado

Construir la siguiente fase sobre esta base:

1. conectar login con autenticacion real
2. integrar dashboard con datos del backend
3. reemplazar el mapa visual por mapa real con seguimiento
4. implementar alertas, clientes y reportes operativos

## Salto a movil

La base ya quedo preparada para empaquetarse con `Capacitor`:

1. instalar dependencias en la raiz del proyecto
2. generar `www/` con `npm run build:web`
3. sincronizar con Android/iPhone usando `Capacitor`
