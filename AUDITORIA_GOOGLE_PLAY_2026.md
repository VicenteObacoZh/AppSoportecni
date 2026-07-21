# Auditoría técnica Google Play 2026 — GpsRastreo

Fecha: 2026-07-18  
Repositorio: `C:\Repositorios\AppSoportecni`

## 1. Resumen ejecutivo

Se auditó el frontend web/Capacitor, el proyecto Android y, sin desplegarlo ni modificar su lógica, el backend Node incluido. Se corrigieron almacenamiento inseguro de contraseñas, tráfico claro, backups, recursos incompatibles con `minSdk 24`, configuración Gradle obsoleta, URLs de desarrollo empaquetadas y vulnerabilidades de dependencias. El flujo web/Capacitor/Gradle termina correctamente con API 36.

El bundle final está firmado con el keystore original. Los tres AAB históricos inspeccionados y el nuevo artefacto comparten el certificado SHA-256 `9D:95:20:AD:99:82:B4:48:93:C2:91:AF:65:13:7E:4D:9C:FC:3A:5D:E8:25:EC:D0:C0:6A:0C:45:0A:12:11:6B`. Las credenciales se leyeron exclusivamente desde un archivo local excluido de Git; no se imprimieron ni copiaron a archivos versionables.

## 2. Veredicto

**LISTO PARA SUBIR**

La firma oficial fue comprobada criptográficamente contra los AAB históricos. Permanecen únicamente pasos manuales de Play Console: confirmar disponibilidad de `versionCode 3`, subir primero a prueba interna, realizar pruebas con cuenta autorizada y completar declaraciones/activos.

## 3. Inventario técnico

| Área | Resultado |
|---|---|
| Aplicación | GpsRastreo / nombre Android visible `GpsRastreo` |
| Contenido | Frontend móvil y backend Node; no se desplegó ni cambió VPS/Nginx/PM2 |
| Frontend | HTML, CSS y JavaScript vanilla |
| Empaquetado | Capacitor 8 (`@capacitor/core`, `android`, `ios`, CLI) |
| Node / npm | Node 24.14.1; npm 11.11.0; lockfiles npm |
| Java | Android Studio JBR OpenJDK 21.0.10 |
| Gradle / AGP | Gradle 9.3.1; Android Gradle Plugin 9.1.1 |
| Kotlin reportado por Gradle | 2.2.21; la app no contiene fuentes Kotlin |
| SDK | `minSdk 24`, `compileSdk 36`, `targetSdk 36` |
| Identidad | `applicationId com.soportecni.gpsrastreo.app`; namespace Java `com.soportecni.gpsrastreo` |
| Versión | `versionCode 3`, `versionName 1.0.2` |
| Backend móvil | `https://rastreo.soportecni.com/api` |
| Variantes | debug y release; release sin `debuggable` y sin firma configurada |
| R8/ProGuard | archivo configurado; `minifyEnabled false` |
| Nativo | el AAB no contiene archivos `.so`; no hay ABI que validar |
| Git inicial | limpio, rama `main` alineada con `origin/main` |

Evidencia principal: `android/app/build.gradle:4-11`, `android/variables.gradle:2-4`, `capacitor.config.ts:4-10`, `src/config.js:39-78`, `package.json`.

## 4. Hallazgos

### Críticos

Ninguna vulnerabilidad crítica conocida fue encontrada por `npm audit`.

### Altos

| Hallazgo | Evidencia | Estado |
|---|---|---|
| Contraseña persistida en texto claro en WebView `localStorage` | versión previa de `src/runtime.js:113-151` | Corregido: solo puede guardarse el email; migración elimina el campo legado |
| Release inicialmente no firmado | Configuración local excluida y keystore histórico | Corregido: AAB firmado, `jar verified` y certificado coincidente |
| Backups y transferencia podían copiar estado sensible de WebView | versión previa de `android/app/src/main/AndroidManifest.xml:5` | Corregido con backups desactivados y reglas de extracción |
| HTTP permitido y origen Capacitor HTTP | versión previa del manifiesto y `capacitor.config.ts:8` | Corregido |

### Medios

| Hallazgo | Evidencia | Estado |
|---|---|---|
| API 29 usada desde recursos base con `minSdk 24` | antiguo `values/styles.xml:17` | Corregido en `values-v29/styles.xml:4` |
| URLs localhost/emulador HTTP podían quedar dentro del AAB | antiguo `src/config.js:39-96` | Corregido; búsqueda final sin coincidencias de desarrollo en assets (excepto namespaces SVG) |
| Dependencias con avisos high/moderate | lockfiles antes de `npm audit fix` | Corregido; ambos árboles reportan 0 |
| Sesión (`sessionId`) y contexto operativo permanecen en `localStorage` | `src/api.js:141-244` | Riesgo residual; backups están bloqueados, pero un dispositivo comprometido podría leerlos |
| Bibliotecas JS/CSS de CDN requieren red en la carga inicial | HTML de dashboard/mapa/rutas y URLs `unpkg.com`, Google Fonts | Pendiente; sin conexión puede faltar mapa/tipografía |
| Renderizado dinámico con `innerHTML` en varias vistas | `src/alerts.js`, `src/devices.js`, `src/routes.js`, `src/runtime.js` | Revisar continuamente; varias rutas escapan texto, pero conviene migrar datos no confiables a `textContent` |

### Bajos

- Lint mantiene advertencias visuales de iconos, splash y recursos duplicados/no usados.
- El proyecto generado `capacitor-cordova-android-plugins` conserva `flatDir`; no hay plugins Cordova ni `.so` empaquetados. Se eliminó el `flatDir` redundante del módulo app, pero `cap sync` regenera el del módulo puente.
- Gradle recomienda optimizaciones de importación/configuration cache; no son bloqueantes de publicación.
- `minifyEnabled false` produce un bundle mayor y sin ofuscación; no se activó R8 sin pruebas de regresión.
- No hay suite automatizada de frontend ni prueba instrumentada funcional; los tests Android son plantillas.

## 5. Correcciones aplicadas

1. Contraseña eliminada del almacenamiento persistente y migración de entradas antiguas.
2. Checkbox cambiado a “Recordar usuario” y desmarcado por defecto.
3. Origen Android Capacitor cambiado a HTTPS.
4. `usesCleartextTraffic=false`.
5. `allowBackup=false`, `fullBackupContent=false` y reglas que excluyen todos los dominios de backup/transferencia.
6. `forceDarkAllowed` movido a recursos API 29.
7. Permisos movidos antes de `<application>` en el manifiesto.
8. Eliminadas URLs HTTP/locales del paquete de producción; desarrollo sigue pudiendo inyectar `GPSRASTREO_BACKEND_URL` o `backendBaseUrl` explícitamente.
9. Opciones Gradle obsoletas eliminadas y repositorio `flatDir` redundante retirado.
10. Dependencias transitivas vulnerables actualizadas en ambos lockfiles.

## 6. Pruebas y compilación

| Prueba | Resultado |
|---|---|
| `npm ci` raíz | OK con caché aislado |
| `npm run build:web` | OK |
| `npm run cap:sync -- android` | OK |
| `npm audit` raíz | OK, 0 vulnerabilidades |
| `npm ci` backend | OK con caché aislado |
| `npm test` backend | OK, 17/17 |
| `npm audit` backend | OK, 0 vulnerabilidades |
| Gradle `clean lint test :app:bundleRelease` | OK |
| Android lint | OK sin errores; advertencias no bloqueantes documentadas |
| Tests Android | OK (prueba unitaria plantilla; librerías sin tests) |
| Búsqueda de localhost/IP privada/HTTP en assets | Sin coincidencias ejecutables |
| Inspección de `.so` | Ninguno; compatible con 16 KB por ausencia de código nativo |
| Verificación de firma | Falla esperada: bundle sin firma |
| Prueba funcional con producción | No ejecutada: falta cuenta de prueba autorizada |

Flujos revisados estáticamente: login/logout, expiración y limpieza de sesión, dispositivos, mapa, ubicación del usuario, eventos, historial, selector personalizado, zona `America/Guayaquil`, enlaces compartidos, errores de red, estados vacíos, modales, tema oscuro y navegación. No se puede certificar el comportamiento real del backend ni UI en todos los tamaños sin credenciales y dispositivos.

## 7. Permisos Android

| Permiso | Uso real | Decisión |
|---|---|---|
| `INTERNET` | API HTTPS, mapas y recursos CDN | Mantener |
| `ACCESS_COARSE_LOCATION` | Botón “Tu ubicación” y fallback de precisión | Mantener |
| `ACCESS_FINE_LOCATION` | `navigator.geolocation` / Capacitor Geolocation con alta precisión en `src/map.js:4051-4080` | Mantener |
| Ubicación en segundo plano | No existe | No agregar |
| Cámara | No existe | No agregar |
| Fotos/archivos | No existe permiso de runtime | No agregar |
| Notificaciones | No existe | No agregar |
| Estado de red | No existe; la app maneja fallos por `fetch` | No agregar |

## 8. Seguridad y privacidad

- Comunicación de producción: HTTPS; cleartext Android bloqueado.
- WebView: únicamente `MainActivity` launcher está exportada; providers están no exportados. El receiver exportado de Profile Installer exige permiso `android.permission.DUMP`.
- Backups: bloqueados para nube y transferencia de dispositivo.
- Tokens: el frontend persiste un `sessionId`, no las cookies reales del portal. El backend conserva sesiones/cookies en memoria.
- Credenciales: ya no se persiste la contraseña en el cliente.
- Datos GPS: se muestran coordenadas, recorrido, estado del vehículo, dirección, conductor y enlaces temporales compartidos.
- Logs: los logs de rendimiento están condicionados; quedan `console.error` operativos que no deberían incluir respuestas completas o tokens.
- CORS: se configura en backend; su política real de producción debe verificarse en VPS. No se cambió Nginx/backend.
- TLS: se usa la validación del sistema WebView/Node; no hay bypass ni trust-all.
- Anuncios/Advertising ID: no se encontraron SDK publicitario, permiso ni acceso a ID de publicidad.
- Cuenta: la app muestra login y cambio de clave, pero no creación de cuenta. Confirmar con negocio si las cuentas se crean fuera de la app.

## 9. Tabla preliminar de Seguridad de los datos

Esta tabla es evidencia técnica, no asesoría legal. Validar retención y compartición del backend con el responsable de privacidad.

| Dato | Recopilado/procesado | Finalidad | Compartido | Obligatorio | Evidencia |
|---|---|---|---|---|---|
| Email/identificador de usuario | Sí | Autenticación y cuenta | Con backend/portal como proveedor del servicio | Sí para login | `src/runtime.js:445-454`, `/auth/login` |
| Contraseña | En tránsito, ya no persistida | Autenticación/cambio de clave | Con backend/portal como proveedor | Sí para login | `src/runtime.js:445-454`, `src/settings.js:183-218` |
| Identificador de sesión | Sí, persistido localmente | Mantener sesión | Backend propio | Sí durante sesión | `src/api.js:141-176` |
| Ubicación aproximada/precisa del usuario | Bajo acción del botón | Mostrar “Tu ubicación” en mapa | No se observa envío al backend | No | `src/map.js:4051-4080` |
| Ubicación de vehículos/activos | Sí | Monitoreo GPS, mapas, historial | Backend/portal; puede compartirse mediante enlace iniciado por usuario | Función central | endpoints monitor/route/share |
| Identificadores de dispositivo GPS/vehículo | Sí | Identificar y operar unidades | Backend/portal | Función central | vistas de dispositivos/mapa |
| Actividad/eventos/alertas | Sí | Seguridad, operación e historial | Backend/portal | Función central | endpoints events/alerts |
| Nombre de conductor/dirección | Puede recibirse | Operación y enlace compartido | Puede aparecer en enlace temporal | Depende de datos | backend `public.js` viewer |
| Diagnóstico | Errores de red locales; sin SDK analítico detectado | Funcionamiento | No detectado | No | búsquedas de dependencias/logs |

Todos los datos enviados al backend se cifran en tránsito. La opción “se comparte” debe responderse según la definición de Google (proveedor de servicio frente a tercero), contratos reales y comportamiento del VPS.

## 10. Requisitos Google Play / Android 2026

- API objetivo: cumple API 36. Desde el 31-08-2026 las actualizaciones normales deben apuntar a Android 16/API 36: <https://developer.android.com/google/play/requirements/target-sdk>.
- Páginas de 16 KB: desde 01-11-2025 aplica a apps API 35+; el bundle no contiene bibliotecas NDK `.so`, por lo que no presenta incompatibilidad nativa observable: <https://developer.android.com/guide/practices/page-sizes>.
- App Bundle: generado.
- 64 bits: no aplica ABI porque no contiene código nativo.
- Play App Signing: requiere comparar certificado de subida y conservar la clave oficial.
- Data Safety: obligatoria y debe corresponder al código/backend: <https://support.google.com/googleplay/android-developer/answer/10787469>.
- Eliminación de cuenta: si se habilita creación de cuentas dentro de la app, se requieren ruta interna y enlace web: <https://support.google.com/googleplay/android-developer/answer/13327111>.
- Pendientes de consola: política de privacidad, clasificación de contenido, acceso de revisores/cuenta de prueba, declaraciones de anuncios, ficha, capturas, icono, público objetivo y contenido de la app.

## 11. AAB generado

| Campo | Valor |
|---|---|
| Ruta | `C:\Repositorios\AppSoportecni\android\app\release\GpsRastreo-PlayStore-v3-1.0.2-SIGNED.aab` |
| Tamaño | 32,265,171 bytes |
| SHA-256 | `62B425CB28C43EBCBAB70BC67F22D2C913CB8B6B9D80092515156EA188048158` |
| applicationId | `com.soportecni.gpsrastreo.app` |
| versionCode / versionName | `3` / `1.0.2` |
| minSdk / targetSdk | `24` / `36` |
| debuggable | No declarado en release (`false` por defecto) |
| Firma | **Firmado — `jar verified`** |
| Certificado del nuevo AAB | SHA-256 `9D:95:20:AD:99:82:B4:48:93:C2:91:AF:65:13:7E:4D:9C:FC:3A:5D:E8:25:EC:D0:C0:6A:0C:45:0A:12:11:6B` |
| Certificado histórico observado | Coincide exactamente |

## 12. Pasos manuales exactos en Play Console

1. Abrir Play Console → GpsRastreo → Configuración → Integridad de la app → Firma de aplicaciones.
2. Copiar (sin publicarla) la huella SHA-256 del **certificado de subida** y compararla con la huella histórica anterior.
3. Identificar qué keystore y alias local produce esa misma huella usando `keytool -list -v`; no compartir contraseña ni guardarla en Git.
4. Si Play Console muestra una huella diferente, detenerse y usar el flujo oficial de restablecimiento de clave de subida; nunca sustituir la clave de firma de aplicación.
5. Confirmar en Explorador de App Bundle/versiones que `versionCode 3` no fue utilizado. Si ya existe, incrementar a 4 y ajustar el nombre.
6. Configurar `signingConfigs.release` leyendo ruta/alias/contraseñas desde variables de entorno o un archivo local ignorado.
7. Regenerar y verificar el AAB con `jarsigner -verify -verbose -certs`; la huella debe coincidir.
8. Subir primero a prueba interna, instalar desde Play y probar login, logout, expiración, dispositivos, mapa, mi ubicación, historial/selector, compartir, sin red, modo oscuro, botón Atrás, rotación y tableta.
9. Proporcionar cuenta de revisor estable y pasos de acceso.
10. Completar Data Safety, política de privacidad, clasificación, anuncios, acceso, eliminación de cuenta si aplica, ficha, icono y capturas.

## 13. Riesgos restantes

- Firma y disponibilidad de `versionCode` sin verificar.
- Pruebas E2E reales pendientes.
- Dependencia de CDN durante carga inicial.
- Sesión/contexto GPS permanecen en almacenamiento local durante el uso.
- Riesgo XSS residual en renderizados `innerHTML`; requiere pruebas con payloads reales.
- Recursos/iconos/splash con advertencias de calidad.
- Backend/VPS, CORS, retención, borrado y política de privacidad no fueron auditados en despliegue.

## 14. Archivos modificados

Versionados:

- `AUDITORIA_GOOGLE_PLAY_2026.md`
- `backend/package-lock.json`
- `capacitor.config.ts`
- `package-lock.json`
- `src/api.js`
- `src/config.js`
- `src/login.html`
- `src/runtime.js`

El proyecto Android dejó de estar ignorado globalmente y ahora puede versionarse como código fuente Capacitor. Sus `.gitignore` conservan fuera de Git `build/`, `.gradle/`, `local.properties`, assets web generados, APK/AAB y todos los almacenes `.jks`, `.keystore` y `.p12`.

Archivos Android fuente modificados:

- `android/app/build.gradle`
- `android/gradle.properties`
- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/main/res/values/styles.xml`
- `android/app/src/main/res/values-v29/styles.xml`
- `android/app/src/main/res/xml/data_extraction_rules.xml`
- assets generados por `cap sync`
- AAB sin firma indicado arriba

También se modificaron `.gitignore` y `android/.gitignore`. Los archivos generados y criptográficos continúan excluidos.

## 15. Investigación posterior de firma

### Fuentes revisadas

- Todos los `.md` de `docs`.
- `docs/Guia-actualizacion-GpsRastreo-v2.docx`, incluyendo todas sus partes OOXML.
- Historial local de PowerShell.
- Historial local de Android Studio.
- Historial Git y archivos de configuración del repositorio.

La guía Word documenta compilación de APK debug y operación del VPS, pero **no** documenta firma de Google Play, alias ni credenciales. La única fuente que identifica una ruta histórica es el historial local de PowerShell:

- keystore histórico referenciado: `android/app/release/gpsrastreo-playstore.jks`;
- segundo candidato localizado: `android/app/soportecni-release.jks`;
- alias completo: no documentado;
- credenciales: no documentadas;
- los AAB históricos contienen entradas `META-INF/GPSRASTR.SF` y `META-INF/GPSRASTR.RSA`, lo cual solo permite inferir un identificador truncado, no demostrar el alias.

### Decisión criptográfica final

El archivo local excluido `android/signing.local.properties` permitió abrir el keystore original sin exponer credenciales. Se identificó:

- keystore: `android/app/release/gpsrastreo-playstore.jks`;
- tipo: PKCS12;
- alias: `gpsrastreo`;
- entrada: `PrivateKeyEntry`;
- vigencia: 2026-05-04 a 2126-04-10;
- SHA-256: coincidencia exacta con los tres AAB históricos.

Gradle lee `storePassword` y `keyPassword` exclusivamente desde ese archivo local, que está excluido mediante `.git/info/exclude`. El keystore y todos los AAB permanecen ignorados por `android/.gitignore`. `jarsigner -verify -verbose -certs` devolvió `jar verified`, código 0, y no encontró estado unsigned.

## 16. Comandos reproducibles

```powershell
cd C:\Repositorios\AppSoportecni
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
npm.cmd ci
npm.cmd audit
npm.cmd run build:web
npm.cmd run cap:sync -- android

cd backend
npm.cmd ci
npm.cmd test
npm.cmd audit

cd ..\android
.\gradlew.bat clean lint test :app:bundleRelease --warning-mode all
```

El último comando produce un AAB sin firma mientras no exista `signingConfigs.release`. La regeneración publicable debe ejecutarse solamente después de verificar la huella oficial y configurar secretos fuera del repositorio.
