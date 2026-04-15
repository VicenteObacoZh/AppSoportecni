# Integracion Backend de GpsRastreo

## Estado actual

La interfaz ya quedo preparada con una capa de integracion simple en frontend:

- `src/config.js`: configuracion central del proyecto
- `src/mock-data.js`: datos demo estructurados
- `src/api.js`: cliente API desacoplado de la UI
- `src/runtime.js`: consumo de servicios y renderizado
- `backend/`: proxy local para evolucionar hacia integracion real

## Enfoque recomendado

Por ahora `mockMode` esta en `true` porque no tenemos un contrato documentado de endpoints reales.

Cuando se definan endpoints reales, el cambio ideal es:

1. poner `mockMode` en `false`
2. levantar el backend local en `http://localhost:4100/api`
3. adaptar `login()` y `getDashboard()` en `src/api.js` si cambia el contrato
4. mantener intactas las vistas HTML/CSS

## Riesgos actuales

- la plataforma `https://rastreo.soportecni.com` responde en vivo
- desde navegador puede existir restriccion de CORS
- el login real probablemente requiere token antifalsificacion y flujo de sesion de servidor

## Camino seguro

La integracion real deberia pasar por una de estas rutas:

- backend propio que consuma la plataforma y exponga endpoints seguros al frontend
- proxy autenticado que maneje cookies, tokens y cabeceras del sistema real

## Proxima fase tecnica

1. documentar el flujo real de autenticacion
2. identificar endpoints de unidades, alertas y reportes
3. implementar un backend intermedio
4. conectar mapa real con posiciones operativas
