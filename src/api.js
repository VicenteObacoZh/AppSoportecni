(function () {
  const config = window.GpsRastreoConfig || {};
  const mock = window.GpsRastreoMock || {};

  function buildUrl(path) {
    const base = (config.backendBaseUrl || '').replace(/\/$/, '');
    const cleanPath = (path || '').startsWith('/') ? path : `/${path || ''}`;
    return `${base}${cleanPath}`;
  }

  function getStoredSessionId() {
    try {
      return window.localStorage.getItem('gpsrastreo.sessionId');
    } catch {
      return null;
    }
  }

  function storeSessionId(sessionId) {
    try {
      if (sessionId) {
        window.localStorage.setItem('gpsrastreo.sessionId', sessionId);
      }
    } catch {
      // no-op
    }
  }

  function clearStoredSessionId() {
    try {
      window.localStorage.removeItem('gpsrastreo.sessionId');
    } catch {
      // no-op
    }
  }

  async function requestJson(path, options) {
    const requestUrl = buildUrl(path);
    let response;

    try {
      response = await fetch(requestUrl, {
        method: 'GET',
        mode: config.requestMode || 'cors',
        headers: {
          'Content-Type': 'application/json'
        },
        ...options
      });
    } catch (error) {
      const networkError = new Error(`No se pudo conectar con ${requestUrl}. ${error?.message || 'Revisa backend y red local.'}`);
      networkError.cause = error;
      throw networkError;
    }

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  async function request(path, options) {
    return requestJson(path, options);
  }

  async function getLiveAlerts(sessionId) {
    try {
      const payload = await request(`/live/alerts/list?sessionId=${encodeURIComponent(sessionId)}`);
      return payload?.data || null;
    } catch (error) {
      if (error.status === 404 || error.status === 401) {
        return null;
      }

      throw error;
    }
  }

  async function getLiveRoute(sessionId, deviceId, from, to) {
    const query = new URLSearchParams({
      sessionId,
      deviceId: String(deviceId),
      from,
      to
    });

    const payload = await request(`/live/monitor/route?${query.toString()}`);
    return payload?.data || null;
  }

  window.GpsRastreoApi = {
    async checkPlatform() {
      if (config.mockMode) {
        return {
          isAvailable: true,
          isLoginScreen: true
        };
      }

      const payload = await request(config.endpoints.health || '/health', { method: 'GET' });
      return {
        isAvailable: payload.ok,
        isLoginScreen: Boolean(payload.isLoginScreen)
      };
    },

    async login(credentials) {
      if (config.mockMode) {
        return {
          ok: true,
          user: mock.session,
          credentials
        };
      }

      return request(config.endpoints.login || '/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
      });
    },

    async getDashboard() {
      if (config.mockMode) {
        return mock.dashboard;
      }

      const sessionId = getStoredSessionId();
      if (!sessionId) {
        throw new Error('SESSION_REQUIRED');
      }

      if (sessionId) {
        let payload;
        try {
          payload = await request(`${config.endpoints.liveMonitorData || '/live/monitor/data'}?sessionId=${encodeURIComponent(sessionId)}`);
        } catch (error) {
          if (error.status === 404 || error.status === 401) {
            clearStoredSessionId();
            const nextError = new Error('SESSION_EXPIRED');
            nextError.payload = error.payload;
            throw nextError;
          }
          throw error;
        }

        if (payload?.ok && payload?.data) {
          const live = payload.data;
          let liveAlerts = null;
          try {
            liveAlerts = await getLiveAlerts(sessionId);
          } catch {
            liveAlerts = null;
          }
          const alertItems = Array.isArray(liveAlerts?.items) ? liveAlerts.items : [];
          const activeAlerts = alertItems.filter((item) => item?.activo);
          const topAlert = activeAlerts[0] || alertItems[0] || null;

          return {
            kpis: [
              { label: 'Unidades visibles', value: String(live.summary.total), detail: 'Dispositivos cargados desde Monitor?handler=Data.' },
              { label: 'En movimiento', value: String(live.summary.moving), detail: 'Velocidad mayor a 3 km/h en la ultima lectura.' },
              { label: 'Con ubicacion', value: String(live.summary.withLocation), detail: 'Unidades con latitud y longitud disponibles.' },
              { label: 'Empresas', value: String(live.summary.companies), detail: 'Empresas visibles dentro del alcance del usuario.' },
              { label: 'Alertas activas', value: String(liveAlerts?.summary?.active ?? 0), detail: 'Configuraciones activas detectadas en el modulo Alertas.' },
              { label: 'Tipos de alerta', value: String(liveAlerts?.summary?.types ?? 0), detail: 'Variedad de reglas activas disponibles para la operacion.' }
            ],
            alerts: (alertItems.length > 0
              ? alertItems.slice(0, 6).map((item) => ({
                  time: item.activo ? 'activa' : 'inactiva',
                  title: item.nombre || 'Alerta',
                  detail: `${item.tipo || 'Sin tipo'} | ${item.dispositivos || 0} dispositivos vinculados`,
                  badge: item.activo ? 'Activa' : 'Inactiva',
                  tone: item.activo ? 'success' : 'muted'
                }))
              : [
                  { time: 'live', title: `Usuario autenticado: ${live.userName || 'sin nombre visible'}` },
                  { time: 'live', title: `Empresa activa: ${live.empresaNombre || 'sin empresa'}` },
                  { time: 'live', title: `Cliente portal: ${live.clienteId || 'sin cliente'}` },
                  { time: 'live', title: `Dispositivos procesados: ${live.afterCount || live.summary.total}` }
                ]),
            roadmap: [
              { area: 'Monitor', detail: 'Sesion real conectada al handler Data del monitor.' },
              { area: 'Alertas', detail: liveAlerts ? 'Modulo Alertas conectado con handler List.' : 'Pendiente validar handler List del modulo Alertas.' },
              { area: 'Mapa', detail: 'Pintando dispositivos reales sobre Leaflet en la nueva interfaz.' },
              { area: 'Siguiente paso', detail: 'Consumir rutas, eventos detallados y geocercas reales con la misma sessionId.' }
            ],
            devices: live.devices || [],
            highlightedUnit: live.devices?.[0]
              ? {
                  name: live.devices[0].vehicleName || live.devices[0].name || 'Primera unidad visible',
                  detail: `IMEI ${live.devices[0].uniqueId || '-'} | ${live.devices[0].groupName || 'Sin empresa'}`
                }
              : {
                  name: 'Sin unidades',
                  detail: 'La sesion esta activa pero no devolvio dispositivos.'
                },
            latestAlert: {
              title: topAlert
                ? `${topAlert.nombre || 'Alerta'}`
                : 'Monitor real conectado',
              detail: topAlert
                ? `${topAlert.tipo || 'Sin tipo'} | ${topAlert.dispositivos || 0} dispositivos | ${topAlert.activo ? 'Activa' : 'Inactiva'}`
                : `La sesion ${sessionId.slice(0, 8)}... ya puede consultar datos autenticados del portal.`
            },
            alertSummary: liveAlerts?.summary || null
          };
        }
      }

      const payload = await request(config.endpoints.dashboard || '/dashboard');
      return payload.data || payload;
    },

    async getAlerts() {
      if (config.mockMode) {
        return {
          summary: {
            total: 0,
            active: 0,
            inactive: 0,
            types: 0
          },
          items: []
        };
      }

      const sessionId = getStoredSessionId();
      if (!sessionId) {
        throw new Error('SESSION_REQUIRED');
      }

      const liveAlerts = await getLiveAlerts(sessionId);
      return liveAlerts || {
        summary: {
          total: 0,
          active: 0,
          inactive: 0,
          types: 0
        },
        items: []
      };
    },

    async getRoute(deviceId, from, to) {
      if (config.mockMode) {
        return {
          summary: {
            total: 0,
            moving: 0
          },
          points: []
        };
      }

      const sessionId = getStoredSessionId();
      if (!sessionId) {
        throw new Error('SESSION_REQUIRED');
      }

      return await getLiveRoute(sessionId, deviceId, from, to);
    },

    async getSessionInfo() {
      const sessionId = getStoredSessionId();
      if (!sessionId) {
        try {
          const latest = await request('/auth/latest-session');
          if (latest?.id) {
            storeSessionId(latest.id);
            return latest;
          }
        } catch {
          return null;
        }

        return null;
      }

      try {
        return await request(`/auth/session/${encodeURIComponent(sessionId)}`);
      } catch (error) {
        if (error.status === 404) {
          clearStoredSessionId();
          return null;
        }
        throw error;
      }
    },

    getStoredSessionId,
    storeSessionId,
    clearStoredSessionId
  };
})();
