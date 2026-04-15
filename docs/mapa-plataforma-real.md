# Mapa de la Plataforma Real

## Repositorio inspeccionado

- Ruta local: `C:\PlataformaSoportecni`
- Proyecto principal: `SoportecniGpsPortal.Web`
- Tipo: `ASP.NET Core` con `Razor Pages`, `Controllers`, `Entity Framework Core`, `Identity` y servicios contra `Traccar`

## Hallazgos clave

La plataforma real no expone una sola API REST pública para todo. Su funcionamiento mezcla:

- `Razor Pages` para páginas y handlers
- `API Controllers` bajo `/api/...`
- `ASP.NET Identity` para autenticación
- `PortalDbContext` para datos del portal
- `ITraccarClient` para datos GPS reales

## Autenticación real

Archivo principal:

- `SoportecniGpsPortal.Web/Pages/Cuenta/Login.cshtml.cs`

Flujo detectado:

1. El login público permitido es `"/Cuenta/Login"`
2. Se valida usuario con `UserManager` y `SignInManager`
3. Se valida además que exista un `Cliente` activo en la base del portal
4. Se cargan claims extra:
   - `cliente_id`
   - `portal_rol`
   - `empresa_id`
   - `empresa_nombre`
   - `empresa_logo`
5. Al autenticarse redirige a `"/Dashboard"`

Conclusión:

- el login real no es contra una API externa directa
- es autenticación propia del portal con cookie de sesión
- sí usa token antifalsificación en formularios

## Configuración del proyecto

Archivo revisado:

- `SoportecniGpsPortal.Web/appsettings.json`

Se detectó:

- conexión PostgreSQL local para el portal
- integración `Traccar`
- configuración SMTP

Importante:

- el archivo local tiene placeholders y configuración de desarrollo
- no conviene exponer ni reutilizar secretos en frontend

## Rutas principales descubiertas

### Páginas base

- `/Cuenta/Login`
- `/Cuenta/Logout`
- `/Dashboard`
- `/Monitoreo/Monitor`
- `/Alertas`
- `/Geocerca`
- `/Dispositivos`
- `/Rutas`
- `/Servicio`
- `/Configuracion`
- `/Reportes/Reportes`
- `/Reportes/RepExcesoVelocidad`
- `/Reportes/ReporteRecorridosParadas`

### API Controllers

#### Geocodificación

Archivo:

- `SoportecniGpsPortal.Web/Controllers/GeocodeController.cs`

Ruta:

- `GET /api/geocode/reverse?lat={lat}&lon={lon}`

#### Notificaciones del portal

Archivo:

- `SoportecniGpsPortal.Web/Controllers/PortalNotificacionesController.cs`

Rutas:

- `GET /api/portal-notificaciones/list`
- `POST /api/portal-notificaciones/read`
- `POST /api/portal-notificaciones/read-all`

## Handlers reales del monitor

Archivo principal:

- `SoportecniGpsPortal.Web/Pages/Monitoreo/Monitor.cshtml.cs`

Handlers detectados:

- `GET ?handler=Services`
- `GET ?handler=Events`
- `GET ?handler=SearchAddress`
- `GET ?handler=Elevation`
- `GET ?handler=DevicePicker`
- `GET ?handler=Data`
- `GET ?handler=Route`
- `POST ?handler=SaveMeta`
- `GET ?handler=Alerts`
- `GET ?handler=CommandLogs`
- `POST ?handler=SendCommand`
- `POST ?handler=SaveIcon`
- `GET ?handler=IconCatalog`
- `POST ?handler=PoiSave`
- `POST ?handler=PoiDelete`
- `GET ?handler=PoiList`

## Configuración expuesta al frontend del monitor

Archivo:

- `SoportecniGpsPortal.Web/Pages/Monitoreo/Monitor.cshtml`

Objeto detectado:

- `window.MONITOR_CONFIG`

URLs publicadas por la propia vista:

- `dataUrl`
- `saveMetaUrl`
- `routeUrlBase`
- `iconCatalogUrl`
- `saveIconUrl`
- `poiListUrl`
- `poiSaveUrl`
- `poiDeleteUrl`
- `poiIconsUrl`
- `searchAddressUrl`
- `geofenceListUrl`
- `routesListUrl`
- `eventsUrl`
- `alertsUrlBase`
- `elevationUrlBase`
- `servicesUrlBase`
- `sendCommandUrl`
- `commandLogsUrl`

## Tecnología del módulo de monitoreo

Archivos clave:

- `wwwroot/js/monitoreo/monitoreo.js`
- `wwwroot/js/monitoreo/monitor-ui.js`
- `wwwroot/js/monitoreo/monitoreo.tabs.js`

Hallazgos:

- usa `Leaflet`
- usa `Leaflet MarkerCluster`
- usa `leaflet-rotatedmarker`
- refresco en vivo cada 5 segundos
- manejo de geocercas, eventos, historial, playback y comandos

## Dashboard real

Archivo:

- `SoportecniGpsPortal.Web/Pages/Dashboard.cshtml.cs`

Datos calculados:

- total de dispositivos
- online
- offline
- unknown
- inactivos
- alertas del día
- servicios próximos
- top dispositivos
- actividad semanal de alertas

## Alertas reales

Archivo:

- `SoportecniGpsPortal.Web/Pages/Alertas.cshtml.cs`

Hallazgos:

- consulta dispositivos desde `Traccar`
- filtra por empresa y rol del cliente
- trabaja geocercas y rutas
- expone handlers para listar y cargar alertas

## Implicaciones para GpsRastreo

GpsRastreo puede construirse de dos maneras:

1. `Integración suave`
   - consumir o emular parte del portal actual
   - mantener backend propio como proxy
   - reutilizar login y módulos por etapas

2. `Rebuild moderno`
   - rehacer frontend con UI nueva
   - conservar backend y reglas de negocio existentes
   - migrar gradualmente monitoreo, alertas y reportes

## Recomendación

La mejor ruta es:

1. usar el portal real como fuente funcional
2. mapear handlers y contratos de datos reales
3. construir `GpsRastreo` como frontend nuevo sobre backend/proxy propio
4. integrar primero login, dashboard y monitoreo
