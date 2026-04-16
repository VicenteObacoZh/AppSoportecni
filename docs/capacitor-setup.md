# GpsRastreo + Capacitor

La base web de `GpsRastreo` ya puede prepararse para Android e iPhone con `Capacitor`.

## Lo que se dejo listo

- `package.json` con scripts para sincronizar la app web con Capacitor
- `capacitor.config.ts` con:
  - `appId`: `com.soportecni.gpsrastreo`
  - `appName`: `GpsRastreo`
  - `webDir`: `www`
- `scripts/prepare-web.mjs` para:
  - copiar `src/` a `www/`
  - copiar `assets/` a `www/assets/`
  - corregir rutas de recursos para empaquetado movil

## Comandos

Desde `C:\AppSoportecni`:

```powershell
npm install
npm run build:web
npx cap sync
```

## Android

```powershell
npx cap add android
npm run cap:android
```

## iPhone

```powershell
npx cap add ios
npm run cap:ios
```

## Flujo recomendado

1. seguir trabajando las vistas web en `src/`
2. regenerar `www/` con:

```powershell
npm run build:web
```

3. sincronizar cambios con:

```powershell
npm run cap:sync
```

4. abrir Android Studio o Xcode desde Capacitor

## Nota

Para desarrollo actual sigue siendo valido:

- backend: `C:\AppSoportecni\backend`
- frontend local: `http://localhost:8080/src/`

Capacitor usa `www/` como salida empaquetable para movil.
