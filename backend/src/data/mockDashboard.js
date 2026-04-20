module.exports = {
  session: {
    userName: 'Operador Central',
    role: 'Operador de monitoreo',
    company: 'Soportecni GPS'
  },
  dashboard: {
    kpis: [
      { label: 'Unidades activas', value: '248', detail: 'Conectadas y reportando posicion en los ultimos minutos.' },
      { label: 'Alertas criticas', value: '06', detail: 'Eventos con necesidad de atencion inmediata.' },
      { label: 'Geocercas', value: '31', detail: 'Reglas activas para zonas de control y seguridad.' },
      { label: 'Disponibilidad', value: '99.2%', detail: 'Indicador estimado de continuidad operacional.' }
    ],
    alerts: [
      { time: '18:42', title: 'Unidad GR-214 ingreso a geocerca segura.' },
      { time: '18:37', title: 'Unidad MX-092 reporto perdida temporal de senal.' },
      { time: '18:31', title: 'Operador asigno seguimiento prioritario a Ruta Norte.' },
      { time: '18:24', title: 'Se genero reporte diario de recorridos y detenciones.' }
    ],
    roadmap: [
      { area: 'Login', detail: 'Integrar credenciales reales con backend seguro.' },
      { area: 'Mapa', detail: 'Conectar Leaflet o Google Maps con posiciones reales.' },
      { area: 'Alertas', detail: 'Agregar filtros, prioridad y auditoria operativa.' },
      { area: 'Reportes', detail: 'Exportar historicos por cliente, unidad y fechas.' }
    ],
    highlightedUnit: {
      name: 'Ruta Cartagena',
      detail: 'Velocidad 74 km/h, bateria estable y ruta dentro de geocerca.'
    },
    latestAlert: {
      title: 'Exceso de velocidad',
      detail: 'Unidad GR-214 supero el umbral configurado hace 2 minutos.'
    }
  },
  liveMonitor: {
    userName: 'Operador Central',
    empresaNombre: 'Soportecni GPS',
    clienteId: 1024,
    empresaId: 21,
    allowedCount: 4,
    afterCount: 4,
    devices: [
      {
        deviceId: 101,
        vehicleName: 'Ruta Cartagena',
        name: 'Ruta Cartagena',
        groupName: 'Operaciones Norte',
        uniqueId: '359881234560001',
        lat: 10.39972,
        lon: -75.51444,
        speedKmh: 74,
        fixTime: '2026-04-19T21:18:00.000Z',
        address: 'Mamonal, Cartagena',
        iconBase: 'flecha'
      },
      {
        deviceId: 102,
        vehicleName: 'Unidad GR-214',
        name: 'Unidad GR-214',
        groupName: 'Operaciones Norte',
        uniqueId: '359881234560002',
        lat: 10.40252,
        lon: -75.50931,
        speedKmh: 0,
        fixTime: '2026-04-19T21:15:00.000Z',
        address: 'Centro Logistico, Cartagena',
        iconBase: 'camionetadoble'
      },
      {
        deviceId: 103,
        vehicleName: 'Unidad MX-092',
        name: 'Unidad MX-092',
        groupName: 'Soporte Tecnico',
        uniqueId: '359881234560003',
        lat: 10.39511,
        lon: -75.52012,
        speedKmh: 12,
        fixTime: '2026-04-19T21:17:00.000Z',
        address: 'Bosque, Cartagena',
        iconBase: 'taxi'
      },
      {
        deviceId: 104,
        vehicleName: 'Patrulla Sur',
        name: 'Patrulla Sur',
        groupName: 'Cobertura Sur',
        uniqueId: '359881234560004',
        lat: 10.38715,
        lon: -75.49783,
        speedKmh: 0,
        fixTime: '2026-04-19T21:10:00.000Z',
        address: 'Zona Industrial, Cartagena',
        iconBase: 'jeep5p'
      }
    ]
  },
  alerts: {
    items: [
      { nombre: 'Exceso de velocidad', tipo: 'Velocidad', activo: true, dispositivos: 12 },
      { nombre: 'Salida de geocerca', tipo: 'Geocerca', activo: true, dispositivos: 4 },
      { nombre: 'Perdida de energia', tipo: 'Energia', activo: false, dispositivos: 18 },
      { nombre: 'Ignicion encendida', tipo: 'Ignicion', activo: true, dispositivos: 9 }
    ]
  },
  recentEvents: [
    {
      eventId: 'evt-1001',
      deviceId: 101,
      vehicleName: 'Ruta Cartagena',
      eventType: '303 - ENCENDIDO',
      latitude: 10.39972,
      longitude: -75.51444,
      speed: 8,
      eventTime: '2026-04-19T21:18:00.000Z',
      address: 'Mamonal, Cartagena',
      iconBase: 'flecha'
    },
    {
      eventId: 'evt-1002',
      deviceId: 103,
      vehicleName: 'Unidad MX-092',
      eventType: '304 - APAGADO',
      latitude: 10.39511,
      longitude: -75.52012,
      speed: 0,
      eventTime: '2026-04-19T21:14:00.000Z',
      address: 'Bosque, Cartagena',
      iconBase: 'taxi'
    },
    {
      eventId: 'evt-1003',
      deviceId: 104,
      vehicleName: 'Patrulla Sur',
      eventType: '150 - EXCESO DE VELOCIDAD',
      latitude: 10.38715,
      longitude: -75.49783,
      speed: 68,
      eventTime: '2026-04-19T21:10:00.000Z',
      address: 'Zona Industrial, Cartagena',
      iconBase: 'jeep5p'
    },
    {
      eventId: 'evt-1004',
      deviceId: 102,
      vehicleName: 'Unidad GR-214',
      eventType: '115 - ENTRADA A GEOCERCA',
      latitude: 10.40252,
      longitude: -75.50931,
      speed: 22,
      eventTime: '2026-04-19T21:06:00.000Z',
      address: 'Centro Logistico, Cartagena',
      iconBase: 'camionetadoble'
    }
  ],
  routePoints: [
    { lat: 10.39200, lon: -75.52100, speedKmh: 8, fixTime: '2026-04-19T17:00:00.000Z', address: 'Cartagena' },
    { lat: 10.39410, lon: -75.51940, speedKmh: 18, fixTime: '2026-04-19T17:12:00.000Z', address: 'Cartagena' },
    { lat: 10.39640, lon: -75.51680, speedKmh: 24, fixTime: '2026-04-19T17:24:00.000Z', address: 'Cartagena' },
    { lat: 10.39820, lon: -75.51420, speedKmh: 15, fixTime: '2026-04-19T17:36:00.000Z', address: 'Cartagena' },
    { lat: 10.40010, lon: -75.51160, speedKmh: 0, fixTime: '2026-04-19T17:48:00.000Z', address: 'Cartagena' }
  ],
  geofences: [
    {
      geofenceId: 'geo-1',
      name: 'Patio Mamonal',
      radiusMeters: 420,
      centerLat: 10.39972,
      centerLon: -75.51444
    },
    {
      geofenceId: 'geo-2',
      name: 'Zona Industrial Segura',
      points: [
        { lat: 10.3884, lon: -75.5017 },
        { lat: 10.3902, lon: -75.4949 },
        { lat: 10.3849, lon: -75.4926 },
        { lat: 10.3828, lon: -75.4998 }
      ]
    }
  ]
};
