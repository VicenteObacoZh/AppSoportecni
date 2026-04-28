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
  const rememberCredentials = document.getElementById('rememberCredentials');
  const apiStatus = document.getElementById('apiStatus');
  const apiMessage = document.getElementById('apiMessage');
  const refreshDashboardButton = document.getElementById('refreshDashboardButton');
  const appShell = window.GpsRastreoShell;
  let liveMap = null;
  let liveMapMarkers = [];

  function setLoginUiState(state, message) {
    if (loginMessage) {
      loginMessage.textContent = '';
    }

    if (integrationBanner) {
      const defaultMessage = 'GpsRastreo - Todos los derechos reservados.';
      integrationBanner.textContent = String(message || '').trim() || defaultMessage;
    }
  }

  function setDashboardUiState(state, message) {
    if (!liveBannerTitle || !liveBannerText) {
      return;
    }

    if (state === 'loading') {
      liveBannerTitle.textContent = 'Cargando datos operativos...';
      liveBannerText.textContent = message || 'Consultando backend y validando sesion.';
      if (refreshDashboardButton) {
        refreshDashboardButton.disabled = true;
      }
      return;
    }

    if (state === 'network_error') {
      liveBannerTitle.textContent = 'Sin conexion con backend';
      liveBannerText.textContent = message || 'No se pudo conectar con backend del servicio. Verifica internet y servidor.';
      if (refreshDashboardButton) {
        refreshDashboardButton.disabled = false;
        refreshDashboardButton.textContent = 'Reintentar';
      }
      return;
    }

    if (state === 'session_expired') {
      liveBannerTitle.textContent = 'Sesion expirada';
      liveBannerText.textContent = message || 'Tu sesion no es valida. Te redirigiremos al login.';
      if (refreshDashboardButton) {
        refreshDashboardButton.disabled = false;
        refreshDashboardButton.textContent = 'Reintentar';
      }
      return;
    }

    if (refreshDashboardButton) {
      refreshDashboardButton.disabled = false;
      refreshDashboardButton.textContent = 'Reconectar panel';
    }
  }

  function getUiErrorReason(error) {
    if (apiClient?.isSessionError?.(error)) {
      return 'session_expired';
    }
    if (apiClient?.isNetworkError?.(error)) {
      return 'backend_unavailable';
    }
    return 'request_error';
  }

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

  function readSavedCredentials() {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const raw = window.localStorage.getItem('gpsrastreo.savedCredentials');
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      if (Object.prototype.hasOwnProperty.call(parsed, 'password')) {
        window.localStorage.setItem('gpsrastreo.savedCredentials', JSON.stringify({
          email: String(parsed.email || ''),
          remember: Boolean(parsed.remember)
        }));
      }

      return {
        email: String(parsed.email || ''),
        password: '',
        remember: Boolean(parsed.remember)
      };
    } catch {
      return null;
    }
  }

  function saveCredentials(email, _password, remember) {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      if (!remember) {
        window.localStorage.removeItem('gpsrastreo.savedCredentials');
        return;
      }

      window.localStorage.setItem('gpsrastreo.savedCredentials', JSON.stringify({
        email: String(email || ''),
        remember: true
      }));
    } catch {
      // no-op
    }
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
        ? `SessionId activa: ${session.id}. El backend tiene cookies para consultar el portal.${session.expiresAt ? ` Expira ${new Date(session.expiresAt).toLocaleString()}.` : ''}`
        : `SessionId activa: ${session.id}. La sesion esta en modo mock controlado por backend.${session.expiresAt ? ` Expira ${new Date(session.expiresAt).toLocaleString()}.` : ''}`;
      return true;
    } catch (error) {
      sessionTitle.textContent = apiClient?.isSessionError?.(error)
        ? 'Sesion expirada'
        : 'No fue posible validar la sesion';
      sessionText.textContent = apiClient?.getUserMessageFromError?.(error) ||
        'Revisa si el backend esta corriendo y si la sessionId sigue vigente.';
      return false;
    }
  }

  async function hydrateDashboard() {
    if (!kpiGrid || !apiClient) {
      return;
    }

    setDashboardUiState('loading');

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

      setDashboardUiState('ready');
    } catch (error) {
      const reason = getUiErrorReason(error);
      const message = apiClient?.getUserMessageFromError?.(error) || 'No fue posible cargar el panel.';
      if (reason === 'session_expired') {
        setDashboardUiState('session_expired', message);
        return;
      }

      setDashboardUiState('network_error', message);
    }
  }

  async function syncPlatformStatus() {
    if (!apiStatus || !apiMessage || !apiClient) {
      return;
    }

    try {
      const status = await apiClient.checkPlatform();
      apiStatus.textContent = status.mode === 'mock'
        ? 'Backend en modo mock'
        : (status.isLoginScreen ? 'Servicio operativo' : 'Servicio accesible');
      apiMessage.textContent = status.mode === 'mock'
        ? 'El backend esta entregando contratos simulados compatibles con login, sessionId, monitor, alertas y rutas.'
        : (status.isLoginScreen
            ? 'La plataforma respondio correctamente y devolvio la pantalla de acceso.'
            : 'La plataforma respondio, aunque la respuesta no coincide con la vista esperada.');
    } catch (error) {
      const reason = getUiErrorReason(error);
      if (reason === 'backend_unavailable') {
        apiStatus.textContent = 'Backend no disponible';
        apiMessage.textContent = apiClient?.getUserMessageFromError?.(error) || 'No se pudo conectar con el backend del servicio.';
        return;
      }

      apiStatus.textContent = 'Validacion no disponible';
      apiMessage.textContent = apiClient?.getUserMessageFromError?.(error) || 'No se pudo validar el estado de plataforma.';
    }
  }

  if (loginForm && apiClient) {
    setLoginUiState('idle', '');

    const loginReasonMessage = appShell?.readLoginMessageFromUrl?.();
    if (loginReasonMessage) {
      setLoginUiState('idle', loginReasonMessage);
    }

    const savedCredentials = readSavedCredentials();
    if (savedCredentials) {
      if (loginForm.elements.email) {
        loginForm.elements.email.value = savedCredentials.email;
      }
      if (rememberCredentials) {
        rememberCredentials.checked = savedCredentials.remember;
      }
    }

    //apiClient.getSessionInfo().then((session) => {
    //  if (session && window.location.pathname.endsWith('/login.html')) {
    //    window.location.href = new URL('./map.html', window.location.href).toString();
    //  }
    //}).catch(() => {});

    loginForm.addEventListener('submit', (event) => {
      event.preventDefault();

      setLoginUiState('loading', 'Ingresando...');

      apiClient.login({
        email: loginForm.elements.email.value,
        password: loginForm.elements.password.value
      }).then((result) => {
        saveCredentials(
          loginForm.elements.email.value,
          loginForm.elements.password.value,
          Boolean(rememberCredentials?.checked)
        );

        setLoginUiState('success', 'Ingreso correcto. Abriendo el mapa...');

        window.setTimeout(() => {
          const nextUrl = new URL('./map.html', window.location.href);
          if (result?.sessionId) {
            nextUrl.searchParams.set('sessionId', result.sessionId);
          }
          window.location.href = nextUrl.toString();
        }, 700);
      }).catch((error) => {
        saveCredentials(
          loginForm.elements.email.value,
          loginForm.elements.password.value,
          Boolean(rememberCredentials?.checked)
        );

        const validationMessages = Array.isArray(error?.payload?.validationMessages)
          ? error.payload.validationMessages.filter(Boolean)
          : [];
        const backendMessage = error?.payload?.message || '';
        const backendCode = error?.payload?.code || error?.code || '';
        const fallbackByCode = backendCode === 'INVALID_CREDENTIALS'
          ? 'Las credenciales no fueron aceptadas por el portal.'
          : backendCode === 'SESSION_NOT_CREATED'
            ? 'El portal autentico, pero no devolvio cookies reutilizables.'
            : backendCode === 'LOGIN_TOKEN_MISSING'
              ? 'No se pudo obtener el token de seguridad del login.'
              : backendCode === 'BACKEND_UNAVAILABLE'
                ? 'No se pudo conectar con el backend del servicio.'
                : '';
        const detailedMessage =
          validationMessages[0] ||
          fallbackByCode ||
          apiClient?.getUserMessageFromError?.(error) ||
          backendMessage ||
          error?.message ||
          'No fue posible iniciar sesion. Revisa la integracion real.';

        const reason = getUiErrorReason(error);
        if (reason === 'backend_unavailable') {
          setLoginUiState('network_error', detailedMessage);
        } else if (reason === 'session_expired') {
          setLoginUiState('session_expired', detailedMessage);
        } else {
          setLoginUiState('idle', detailedMessage);
        }

        if (integrationBanner && validationMessages.length > 1) {
          integrationBanner.textContent = validationMessages.join(' | ');
        }
      });
    });
  }

  if (refreshDashboardButton) {
    refreshDashboardButton.addEventListener('click', async () => {
      setDashboardUiState('loading', 'Reintentando carga de panel...');
      await syncSessionInfo();
      await hydrateDashboard();
    });
  }

  function attachRuntimeEventHandlers() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return;
    }

    window.addEventListener('gpsrastreo:network-error', (event) => {
      const message = String(event?.detail?.message || '').trim() || 'No se pudo conectar con backend del servicio.';

      if (loginForm) {
        setLoginUiState('network_error', message);
      }

      if (kpiGrid) {
        setDashboardUiState('network_error', message);
      }
    });

    window.addEventListener('gpsrastreo:session-expired', (event) => {
      const message = String(event?.detail?.message || '').trim();

      if (loginForm) {
        setLoginUiState('session_expired', message);
      }

      if (kpiGrid) {
        setDashboardUiState('session_expired', message);
      }
    });
  }

  async function bootDashboard() {
    syncSessionIdFromUrl();
    await syncSessionInfo();
    await hydrateDashboard();
    await syncPlatformStatus();
  }

  attachRuntimeEventHandlers();
  if (kpiGrid || liveMapElement || deviceList) {
     bootDashboard();
  }
})();

