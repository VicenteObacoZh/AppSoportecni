window.GpsRastreoMock = {
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
  }
};
