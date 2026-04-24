# APK de Produccion GpsRastreo

## Objetivo

Generar un APK Android de `GpsRastreo` apuntando al entorno productivo.

## Configuracion usada

- Nombre visible de la app: `GpsRastreo`
- URL base esperada del backend de la app: `https://rastreo.soportecni.com/api`
- URL web del portal: `https://rastreo.soportecni.com`

## Punto importante

La app movil no consume directamente la pagina web del portal.
Consume el backend Node de la app en rutas como:

- `/api/health`
- `/api/auth/login`
- `/api/live/monitor/data`
- `/api/live/reports/generate`

Por eso, en produccion el VPS debe exponer `https://rastreo.soportecni.com/api/*`
hacia el backend Node de `AppSoportecni`.

Si solo esta publicado el portal ASP.NET y no existe ese proxy `/api`, el APK mostrara errores de conexion.

## Tunel SSH de base de datos

Si el backend o la plataforma necesitan llegar a PostgreSQL por tunel:

```bash
ssh -p 2222 -L 5433:127.0.0.1:5432 SISTEMABD@45.70.200.155 -N
```

Ese tunel no lo usa el APK directamente.
Lo usan los servicios del servidor cuando necesitan conectarse a la base de datos.

## Compilar web y sincronizar Android

Desde la raiz del proyecto:

```powershell
npm run build:web
npx cap sync android
```

## Generar APK debug

Desde `android/`:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat :app:assembleDebug
```

APK generado:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Si cambia el dominio o backend

Editar:

- `src/config.js`
- `backend/.env`

Valores a revisar:

- `productionFallback`
- `apiBaseUrl`
- `PLATFORM_BASE_URL`

## Checklist antes de entregar un APK

1. Confirmar que `https://rastreo.soportecni.com/api/health` responda.
2. Confirmar que el launcher muestre `GpsRastreo`.
3. Confirmar que el icono no salga con fondo blanco.
4. Generar `build:web`.
5. Ejecutar `cap sync android`.
6. Generar `assembleDebug` o release si ya existe firma.
