(function () {
  const config = window.GpsRastreoConfig || {};

  function syncRuntimeMode(payload) {
    const mode = String(payload?.mode || '').trim().toLowerCase();
    if (!mode) {
      return;
    }

    config.mockMode = mode === 'mock';
    config.runtimeMode = mode;

    if (payload?.sessionTtlMinutes) {
      config.sessionTtlMinutes = Number(payload.sessionTtlMinutes);
    }

    if (payload?.capabilities && typeof payload.capabilities === 'object') {
      config.capabilities = payload.capabilities;
    }
  }

  function normalizeBaseUrl(value) {
    return String(value || '').trim().replace(/\/$/, '');
  }

  function getBackendBaseUrls() {
    const candidates = [];
    const configuredCandidates = Array.isArray(config.backendBaseUrlCandidates)
      ? config.backendBaseUrlCandidates
      : [];

    configuredCandidates.forEach((item) => {
      const normalized = normalizeBaseUrl(item);
      if (normalized) {
        candidates.push(normalized);
      }
    });

    const primary = normalizeBaseUrl(config.backendBaseUrl);
    if (primary) {
      candidates.unshift(primary);
    }

    return [...new Set(candidates)];
  }

  function buildUrl(path, baseUrl) {
    const base = normalizeBaseUrl(baseUrl || config.backendBaseUrl);
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

  function storeSelectedEvent(eventItem) {
    try {
      if (eventItem) {
        window.localStorage.setItem('gpsrastreo.selectedEvent', JSON.stringify(eventItem));
      }
    } catch {
      // no-op
    }
  }

  function getSelectedEvent() {
    try {
      const raw = window.localStorage.getItem('gpsrastreo.selectedEvent');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function clearSelectedEvent() {
    try {
      window.localStorage.removeItem('gpsrastreo.selectedEvent');
    } catch {
      // no-op
    }
  }

  function storeSelectedDevice(device) {
    try {
      if (device) {
        window.localStorage.setItem('gpsrastreo.selectedDevice', JSON.stringify(device));
      }
    } catch {
      // no-op
    }
  }

  function getSelectedDevice() {
    try {
      const raw = window.localStorage.getItem('gpsrastreo.selectedDevice');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function clearSelectedDevice() {
    try {
      window.localStorage.removeItem('gpsrastreo.selectedDevice');
    } catch {
      // no-op
    }
  }

  function storeRouteContext(routeContext) {
    try {
      if (routeContext) {
        window.localStorage.setItem('gpsrastreo.routeContext', JSON.stringify(routeContext));
      }
    } catch {
      // no-op
    }
  }

  function getRouteContext() {
    try {
      const raw = window.localStorage.getItem('gpsrastreo.routeContext');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function clearRouteContext() {
    try {
      window.localStorage.removeItem('gpsrastreo.routeContext');
    } catch {
      // no-op
    }
  }

  function clearOperationalState() {
    clearStoredSessionId();
    clearSelectedEvent();
    clearSelectedDevice();
    clearRouteContext();
  }

  async function requestJson(path, options) {
    const backendBaseUrls = getBackendBaseUrls();
    let lastNetworkError = null;

    for (const baseUrl of backendBaseUrls) {
      const requestUrl = buildUrl(path, baseUrl);
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
        lastNetworkError = { error, requestUrl };
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await response.json()
        : await response.text();

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        error.payload = payload;
        error.code = payload?.code || '';
        throw error;
      }

      config.backendBaseUrl = baseUrl;
      return payload;
    }

    if (lastNetworkError) {
      const networkError = new Error(`No se pudo conectar con ${lastNetworkError.requestUrl}. ${lastNetworkError.error?.message || 'Revisa backend y red local.'}`);
      networkError.code = 'BACKEND_UNAVAILABLE';
      networkError.cause = lastNetworkError.error;
      throw networkError;
    }

    throw new Error('No hay backendBaseUrl configurado para la aplicacion.');
  }

  async function request(path, options) {
    return requestJson(path, options);
  }

  async function getLiveAlerts(sessionId) {
    try {
      const payload = await request(`${config.endpoints.liveAlertsList || '/live/alerts/list'}?sessionId=${encodeURIComponent(sessionId)}`);
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

    const payload = await request(`${config.endpoints.liveMonitorRoute || '/live/monitor/route'}?${query.toString()}`);
    return payload?.data || null;
  }

  async function getRecentEventsBySession(sessionId, limit = 30) {
    const query = new URLSearchParams({
      sessionId,
      limit: String(limit)
    });

    const payload = await request(`${config.endpoints.liveEventsRecent || '/live/monitor/events/recent'}?${query.toString()}`);
    return payload?.data || {
      items: [],
      summary: { total: 0 }
    };
  }

  async function getGeofencesBySession(sessionId) {
    const query = new URLSearchParams({
      sessionId
    });

    const payload = await request(`${config.endpoints.liveGeofences || '/live/monitor/geofences'}?${query.toString()}`);
    return payload?.data || {
      available: false,
      items: [],
      summary: { total: 0 }
    };
  }

  async function reverseGeocode(lat, lon) {
    const query = new URLSearchParams({
      lat: String(lat),
      lon: String(lon)
    });
    const payload = await request(`/live/geocode/reverse?${query.toString()}`);
    return payload?.data?.address || null;
  }

  async function sendCommandBySession(sessionId, { deviceId, command, authorizationKey }) {
    const payload = await request(config.endpoints.liveMonitorCommand || '/live/monitor/command', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        deviceId,
        command,
        authorizationKey
      })
    });

    return payload?.data || payload || null;
  }

  window.GpsRastreoApi = {
    async checkPlatform() {
      const payload = await request(config.endpoints.health || '/health', { method: 'GET' });
      syncRuntimeMode(payload);
      return {
        isAvailable: payload.ok,
        isLoginScreen: Boolean(payload.isLoginScreen ?? true),
        mode: payload.mode || (config.mockMode ? 'mock' : 'live'),
        capabilities: payload.capabilities || null,
        sessionTtlMinutes: payload.sessionTtlMinutes || null
      };
    },

    async login(credentials) {
      const payload = await request(config.endpoints.login || '/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
      });
      syncRuntimeMode(payload);
      if (payload?.sessionId) {
        storeSessionId(payload.sessionId);
      }
      return payload;
    },

    async getDashboard() {
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
            clearOperationalState();
            const nextError = new Error('SESSION_EXPIRED');
            nextError.payload = error.payload;
            nextError.code = error.code || error.payload?.code || 'SESSION_EXPIRED';
            throw nextError;
          }
          throw error;
        }

        if (payload?.ok && payload?.data) {
          syncRuntimeMode(payload);
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
      const sessionId = getStoredSessionId();
      if (!sessionId) {
        throw new Error('SESSION_REQUIRED');
      }

      let liveAlerts;
      try {
        liveAlerts = await getLiveAlerts(sessionId);
      } catch (error) {
        if (error.status === 404 || error.status === 401) {
          clearOperationalState();
          const nextError = new Error('SESSION_EXPIRED');
          nextError.payload = error.payload;
          nextError.code = error.code || error.payload?.code || 'SESSION_EXPIRED';
          throw nextError;
        }
        throw error;
      }

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
      const sessionId = getStoredSessionId();
      if (!sessionId) {
        throw new Error('SESSION_REQUIRED');
      }

      try {
        return await getLiveRoute(sessionId, deviceId, from, to);
      } catch (error) {
        if (error.status === 404 || error.status === 401) {
          clearOperationalState();
          const nextError = new Error('SESSION_EXPIRED');
          nextError.payload = error.payload;
          nextError.code = error.code || error.payload?.code || 'SESSION_EXPIRED';
          throw nextError;
        }
        throw error;
      }
    },

    async sendCommand(commandData) {
      const sessionId = getStoredSessionId();
      if (!sessionId) {
        throw new Error('SESSION_REQUIRED');
      }

      try {
        return await sendCommandBySession(sessionId, commandData || {});
      } catch (error) {
        if (error.status === 404 || error.status === 401) {
          clearOperationalState();
          const nextError = new Error('SESSION_EXPIRED');
          nextError.payload = error.payload;
          nextError.code = error.code || error.payload?.code || 'SESSION_EXPIRED';
          throw nextError;
        }

        throw error;
      }
    },

    async getRecentEvents(limit = 30) {
      const sessionId = getStoredSessionId();
      if (!sessionId) {
        throw new Error('SESSION_REQUIRED');
      }

      try {
        return await getRecentEventsBySession(sessionId, limit);
      } catch (error) {
        if (error.status === 404 || error.status === 401) {
          clearOperationalState();
          const nextError = new Error('SESSION_EXPIRED');
          nextError.payload = error.payload;
          nextError.code = error.code || error.payload?.code || 'SESSION_EXPIRED';
          throw nextError;
        }
        throw error;
      }
    },

    async getGeofences() {
      const sessionId = getStoredSessionId();
      if (!sessionId) {
        throw new Error('SESSION_REQUIRED');
      }

      try {
        return await getGeofencesBySession(sessionId);
      } catch (error) {
        if (error.status === 404 || error.status === 401) {
          clearOperationalState();
          const nextError = new Error('SESSION_EXPIRED');
          nextError.payload = error.payload;
          nextError.code = error.code || error.payload?.code || 'SESSION_EXPIRED';
          throw nextError;
        }

        if (error.status === 501) {
          return {
            available: false,
            items: [],
            summary: { total: 0 }
          };
        }

        throw error;
      }
    },

    async reverseGeocode(lat, lon) {
      if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
        return null;
      }

      try {
        return await reverseGeocode(lat, lon);
      } catch {
        return null;
      }
    },

    async getSessionInfo() {
      const sessionId = getStoredSessionId();
      if (!sessionId) {
      try {
        const latest = await request(config.endpoints.authLatestSession || '/auth/latest-session');
        if (latest?.id) {
          syncRuntimeMode(latest);
          storeSessionId(latest.id);
          return latest;
          }
        } catch {
          return null;
        }

        return null;
      }

      try {
        const payload = await request(`${config.endpoints.authSession || '/auth/session'}/${encodeURIComponent(sessionId)}`);
        syncRuntimeMode(payload);
        return payload;
      } catch (error) {
        if (error.status === 404 || error.status === 401) {
          clearOperationalState();
          return null;
        }
        throw error;
      }
    },

    getStoredSessionId,
    storeSessionId,
    clearStoredSessionId,
    storeSelectedEvent,
    getSelectedEvent,
    clearSelectedEvent,
    storeSelectedDevice,
    getSelectedDevice,
    clearSelectedDevice,
    storeRouteContext,
    getRouteContext,
    clearRouteContext,
    clearOperationalState
  };
})();
