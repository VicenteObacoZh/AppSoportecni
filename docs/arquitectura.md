# Arquitectura Inicial de GpsRastreo

## Vision

GpsRastreo se plantea como una cabina de monitoreo satelital para operaciones, soporte y trazabilidad de unidades o activos.

## Objetivos funcionales

- visualizar unidades en tiempo real
- administrar clientes, dispositivos y activos
- centralizar alertas operativas
- consultar historicos y recorridos
- facilitar la operacion diaria del equipo de monitoreo

## Modulos iniciales

### 1. Acceso y autenticacion
- login seguro
- recuperacion de acceso
- control por roles

### 2. Dashboard principal
- resumen de estado del sistema
- panel de unidades conectadas
- accesos rapidos a alertas y reportes

### 3. Seguimiento en mapa
- ubicacion actual
- velocidad
- rumbo
- ultimo evento
- trazado de recorridos

### 4. Alertas
- exceso de velocidad
- geocercas
- desconexion
- bateria o energia
- eventos criticos definidos por negocio

### 5. Clientes y activos
- empresas
- usuarios
- unidades
- dispositivos GPS
- asignaciones

### 6. Reportes
- historial por fechas
- recorrido detallado
- tiempos detenidos
- exportacion de informacion

## Integracion tecnica sugerida

### Frontend
- evolucionar esta base HTML/CSS/JS hacia React, Next.js o una SPA modular si el proyecto crece rapido

### Backend
- consumir la plataforma viva o exponer integraciones controladas desde `https://rastreo.soportecni.com`
- usar proxy seguro para evitar problemas de CORS y proteger credenciales

### Seguridad
- no exponer credenciales en frontend
- separar autenticacion, consultas y permisos por rol

## Identidad visual

- tono oscuro espacial
- acentos azul electrico, cian, rojo GPS y amarillo orbital
- iconografia inspirada en satelite, orbita, geolocalizacion y monitoreo en tiempo real

## Fase siguiente

1. reemplazar la demo estatica por login real
2. definir endpoints o estrategia de integracion
3. construir dashboard con datos reales
4. preparar modulo de mapa y alertas
