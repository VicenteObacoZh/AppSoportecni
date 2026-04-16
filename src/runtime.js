(function () {
  const apiClient = window.GpsRastreoApi;
  const appConfig = window.GpsRastreoConfig || {};

  const integrationBanner = document.getElementById('integrationBanner');
  const liveBannerTitle = document.getElementById('liveBannerTitle');
  const liveBannerText = document.getElementById('liveBannerText');
  const kpiGrid = document.getElementById('kpiGrid');
  const eventList = document.getElementById('eventList');
  const roadmapList = document.getElementById('roadmapList');
  const latestAlertTitle = document.getElementById('latestAlertTitle');
  const latestAlertText = document.getElementById('latestAlertText');
  const highlightedUnitTitle = document.getElementById('highlightedUnitTitle');
  const highlightedUnitText = document.getElementById('highlightedUnitText');
  const sessionTitle = document.getElementById('sessionTitle');
  const sessionText = document.getElementById('sessionText');
  const deviceList = document.getElementById('deviceList');
  const liveMapElement = document.getElementById('liveMap');
  const mapEmptyState = document.getElementById('mapEmptyState');
  const loginForm = document.getElementById('loginForm');
  const loginMessage = document.getElementById('loginMessage');
  const apiStatus = document.getElementById('apiStatus');
  const apiMessage = document.getElementById('apiMessage');
  const refreshDashboardButton = document.getElementById('refreshDashboardButton');
  let liveMap = null;
  let liveMapMarkers = [];

  function syncSessionIdFromUrl() {
    if (!apiClient || typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);
    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId) {
      return;
    }

    apiClient.storeSessionId(sessionId);
    url.searchParams.delete('sessionId');
    window.history.replaceState({}, '', url.toString());
  }

  function renderKpis(items) {
    if (!kpiGrid) {
      return;
    }

    kpiGrid.innerHTML = items.map((item) => `
      <article class="widget">
        <p class="eyebrow">${item.label}</p>
        <h3>${item.value}</h3>
        <p>${item.detail}</p>
      </article>
    `).join('');
  }

  function renderRows(container, items, keyLabel) {
    if (!container) {
      return;
    }

    container.innerHTML = items.map((item) => `
      <div class="event-row">
        <div class="event-row__top">
          <strong>${item[keyLabel] || item.title || 'Dato'}</strong>
          ${item.badge ? `<span class="event-badge event-badge--${item.tone || 'muted'}">${item.badge}</span>` : ''}
        </div>
        <span>${item.title && item[keyLabel] ? item.title : (item.detail || '')}</span>
        ${item.detail && item.title && item[keyLabel] ? `<small>${item.detail}</small>` : ''}
      </div>
    `).join('');
  }

  function renderDevices(devices) {
    if (!deviceList) {
      return;
    }

    if (!devices || devices.length === 0) {
      deviceList.innerHTML = `
        <div class="event-row">
          <strong>Sin datos</strong>
          <span>La sesion esta activa pero el monitor no devolvio unidades visibles.</span>
        </div>
      `;
      return;
    }

    deviceList.innerHTML = devices.slice(0, 6).map((item) => `
      <div class="event-row">
        <strong>${item.vehicleName || item.name || 'Unidad'}</strong>
        <span>${item.groupName || 'Sin empresa'} | IMEI ${item.uniqueId || '-'} | ${item.lat ?? '-'}, ${item.lon ?? '-'}</span>
      </div>
    `).join('');
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function ensureMap() {
    if (!liveMapElement || typeof window.L === 'undefined') {
      return null;
    }

    if (!liveMap) {
      liveMap = window.L.map(liveMapElement, {
        zoomControl: true,
        attributionControl: true
      }).setView([-4.05, -78.92], 12);

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(liveMap);
    }

    return liveMap;
  }

  function clearMapMarkers() {
    if (!liveMap) {
      return;
    }

    liveMapMarkers.forEach((marker) => marker.remove());
    liveMapMarkers = [];
  }

  function buildMarkerIcon(device) {
    const speed = Number(device?.speedKmh || 0);
    const statusClass = speed > 3
      ? 'gps-marker--moving'
      : (speed > 0 ? 'gps-marker--offline' : 'gps-marker--stopped');

    return window.L.divIcon({
      className: '',
      html: `<div class="gps-marker ${statusClass}"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      popupAnchor: [0, -8]
    });
  }

  function renderLiveMap(devices) {
    const map = ensureMap();
    if (!map) {
      return;
    }

    clearMapMarkers();

    const withLocation = (devices || [])
      .filter((item) => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon)));

    if (mapEmptyState) {
      mapEmptyState.style.display = withLocation.length > 0 ? 'none' : '';
    }

    if (withLocation.length === 0) {
      map.setView([-4.05, -78.92], 12);
      return;
    }

    const bounds = [];

    withLocation.forEach((device) => {
      const lat = Number(device.lat);
      const lon = Number(device.lon);
      const marker = window.L.marker([lat, lon], {
        icon: buildMarkerIcon(device)
      }).addTo(map);

      marker.bindPopup(`
        <div class="gps-popup">
          <strong>${escapeHtml(device.vehicleName || device.name || 'Unidad')}</strong>
          <span>Empresa: ${escapeHtml(device.groupName || 'Sin empresa')}</span>
          <span>IMEI: ${escapeHtml(device.uniqueId || '-')}</span>
          <span>Velocidad: ${escapeHtml(device.speedKmh ?? 0)} km/h</span>
        </div>
      `);

      liveMapMarkers.push(marker);
      bounds.push([lat, lon]);
    });

    if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    } else {
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }

  async function syncSessionInfo() {
    if (!apiClient || !sessionTitle || !sessionText) {
      return false;
    }

    try {
      const session = await apiClient.getSessionInfo();
      if (!session) {
        sessionTitle.textContent = 'Sin sessionId activa';
        sessionText.textContent = 'Debes iniciar sesion otra vez desde login.html para consultar datos reales del monitor.';
        return false;
      }

      sessionTitle.textContent = session.mode === 'live' ? 'Sesion real detectada' : 'Sesion demo detectada';
      sessionText.textContent = session.hasCookies
        ? `SessionId activa: ${session.id}. El backend tiene cookies para consultar el portal.`
        : `SessionId activa: ${session.id}. La sesion aun no tiene cookies reales.`;
      return true;
    } catch {
      sessionTitle.textContent = 'No fue posible validar la sesion';
      sessionText.textContent = 'Revisa si el backend esta corriendo y si la sessionId sigue vigente.';
      return false;
    }
  }

  async function hydrateDashboard() {
    if (!kpiGrid || !apiClient) {
      return;
    }

    try {
      const dashboard = await apiClient.getDashboard();
      renderKpis(dashboard.kpis || []);
      renderRows(eventList, dashboard.alerts || [], 'time');
      renderRows(roadmapList, dashboard.roadmap || [], 'area');
      renderDevices(dashboard.devices || []);
      renderLiveMap(dashboard.devices || []);

      if (latestAlertTitle && latestAlertText && dashboard.latestAlert) {
        latestAlertTitle.textContent = dashboard.latestAlert.title;
        latestAlertText.textContent = dashboard.latestAlert.detail;
      }

      if (highlightedUnitTitle && highlightedUnitText && dashboard.highlightedUnit) {
        highlightedUnitTitle.textContent = dashboard.highlightedUnit.name;
        highlightedUnitText.textContent = dashboard.highlightedUnit.detail;
      }

      if (liveBannerTitle && liveBannerText) {
        liveBannerTitle.textContent = appConfig.mockMode
          ? 'Modo demo activo con capa de integracion lista'
          : 'Conectado al backend real';
        liveBannerText.textContent = appConfig.mockMode
          ? 'La interfaz ya consume una abstraccion API. El siguiente paso es reemplazar los endpoints demo por endpoints reales.'
          : 'La aplicacion esta usando datos reales desde el servicio configurado.';
      }
    } catch (error) {
      if (liveBannerTitle && liveBannerText) {
        if (error.message === 'SESSION_REQUIRED' || error.message === 'SESSION_EXPIRED') {
          liveBannerTitle.textContent = 'Sesion requerida para datos reales';
          liveBannerText.textContent = 'Haz login otra vez para crear una sessionId valida en el backend y volver a cargar el monitor real.';
        } else {
          liveBannerTitle.textContent = 'No fue posible cargar el panel';
          liveBannerText.textContent = 'Revisa endpoints, proxy o credenciales de integracion antes de pasar a produccion.';
        }
      }
    }
  }

  async function syncPlatformStatus() {
    if (!apiStatus || !apiMessage || !apiClient) {
      return;
    }

    try {
      const status = await apiClient.checkPlatform();
      apiStatus.textContent = status.isLoginScreen ? 'Servicio operativo' : 'Servicio accesible';
      apiMessage.textContent = status.isLoginScreen
        ? 'La plataforma respondio correctamente y devolvio la pantalla de acceso.'
        : 'La plataforma respondio, aunque la respuesta no coincide con la vista esperada.';
    } catch (error) {
      apiStatus.textContent = 'Validacion desde navegador limitada';
      apiMessage.textContent = 'La plataforma existe, pero el navegador puede bloquear la consulta directa por CORS. La integracion real se puede hacer con backend o proxy seguro.';
    }
  }

  if (loginForm && apiClient) {
    loginForm.addEventListener('submit', (event) => {
      event.preventDefault();

      if (loginMessage) {
        loginMessage.textContent = 'Validando acceso con la capa de integracion actual...';
      }

      if (integrationBanner) {
        integrationBanner.textContent = appConfig.mockMode
          ? 'Modo demo activo. El formulario ya esta listo para conectarse a un endpoint real.'
          : 'Conectando con el servicio configurado...';
      }

      apiClient.login({
        email: loginForm.elements.email.value,
        password: loginForm.elements.password.value
      }).then((result) => {
        if (result?.sessionId) {
          apiClient.storeSessionId(result.sessionId);
        }

        if (loginMessage) {
          loginMessage.textContent = 'Validacion completada. Redirigiendo al dashboard operativo...';
        }

        window.setTimeout(() => {
          const nextUrl = new URL('./map.html', window.location.href);
          if (result?.sessionId) {
            nextUrl.searchParams.set('sessionId', result.sessionId);
          }
          window.location.href = nextUrl.toString();
        }, 700);
      }).catch((error) => {
        const validationMessages = Array.isArray(error?.payload?.validationMessages)
          ? error.payload.validationMessages.filter(Boolean)
          : [];
        const backendMessage = error?.payload?.message || '';
        const detailedMessage =
          validationMessages[0] ||
          backendMessage ||
          error?.message ||
          'No fue posible iniciar sesion. Revisa la integracion real.';

        if (loginMessage) {
          loginMessage.textContent = detailedMessage;
        }

        if (integrationBanner) {
          integrationBanner.textContent = validationMessages.length > 1
            ? validationMessages.join(' | ')
            : detailedMessage;
        }
      });
    });
  }

  if (refreshDashboardButton) {
    refreshDashboardButton.addEventListener('click', async () => {
      await syncSessionInfo();
      await hydrateDashboard();
    });
  }

  async function bootDashboard() {
    syncSessionIdFromUrl();
    await syncSessionInfo();
    await hydrateDashboard();
    await syncPlatformStatus();
  }

  bootDashboard();
})();
