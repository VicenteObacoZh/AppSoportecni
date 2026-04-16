(function () {
  const apiClient = window.GpsRastreoApi;

  const sessionTitle = document.getElementById('routesSessionTitle');
  const sessionText = document.getElementById('routesSessionText');
  const deviceSelect = document.getElementById('routeDeviceSelect');
  const fromInput = document.getElementById('routeFrom');
  const toInput = document.getElementById('routeTo');
  const loadButton = document.getElementById('loadRouteButton');
  const summary = document.getElementById('routeSummary');
  const pointsList = document.getElementById('routePointsList');
  const signalPill = document.getElementById('routeSignalPill');
  const mapElement = document.getElementById('routeMap');
  const mapEmptyState = document.getElementById('routeMapEmptyState');

  let routeMap = null;
  let routeMarkers = [];
  let routePolyline = null;
  let currentDevices = [];

  function formatDateTimeLocal(date) {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function setDefaultRange() {
    const now = new Date();
    const before = new Date(now.getTime() - (4 * 60 * 60 * 1000));
    fromInput.value = formatDateTimeLocal(before);
    toInput.value = formatDateTimeLocal(now);
  }

  function renderSummary(routeData) {
    if (!summary) {
      return;
    }

    const total = Number(routeData?.summary?.total || 0);
    const moving = Number(routeData?.summary?.moving || 0);
    const first = routeData?.points?.[0] || null;
    const last = routeData?.points?.[routeData.points.length - 1] || null;

    summary.innerHTML = `
      <article class="widget">
        <p class="eyebrow">Puntos</p>
        <h3>${total}</h3>
        <p>Muestras devueltas por el handler Route.</p>
      </article>
      <article class="widget">
        <p class="eyebrow">En movimiento</p>
        <h3>${moving}</h3>
        <p>Puntos con velocidad mayor a 3 km/h.</p>
      </article>
      <article class="widget">
        <p class="eyebrow">Inicio</p>
        <h3>${first?.fixTime ? new Date(first.fixTime).toLocaleTimeString() : '--:--'}</h3>
        <p>Primer punto del rango consultado.</p>
      </article>
      <article class="widget">
        <p class="eyebrow">Fin</p>
        <h3>${last?.fixTime ? new Date(last.fixTime).toLocaleTimeString() : '--:--'}</h3>
        <p>Ultimo punto del rango consultado.</p>
      </article>
    `;
  }

  function renderPoints(points) {
    if (!pointsList) {
      return;
    }

    if (!points.length) {
      pointsList.innerHTML = `
        <div class="event-row">
          <strong>Sin puntos</strong>
          <span>La ruta consultada no devolvio posiciones dentro del rango.</span>
        </div>
      `;
      return;
    }

    pointsList.innerHTML = points.slice(-10).reverse().map((point, index) => `
      <div class="event-row">
        <div class="event-row__top">
          <strong>Punto ${points.length - index}</strong>
          <span class="event-badge event-badge--${Number(point.speedKmh || 0) > 3 ? 'success' : 'muted'}">
            ${Number(point.speedKmh || 0)} km/h
          </span>
        </div>
        <span>${point.fixTime ? new Date(point.fixTime).toLocaleString() : 'Sin hora visible'}</span>
        <small>${point.lat}, ${point.lon}</small>
      </div>
    `).join('');
  }

  function ensureMap() {
    if (!mapElement || typeof window.L === 'undefined') {
      return null;
    }

    if (!routeMap) {
      routeMap = window.L.map(mapElement, {
        zoomControl: true,
        attributionControl: true
      }).setView([-4.05, -78.92], 12);

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(routeMap);
    }

    return routeMap;
  }

  function clearRouteMap() {
    if (!routeMap) {
      return;
    }

    routeMarkers.forEach((marker) => marker.remove());
    routeMarkers = [];

    if (routePolyline) {
      routePolyline.remove();
      routePolyline = null;
    }
  }

  function renderRoute(points) {
    const map = ensureMap();
    if (!map) {
      return;
    }

    clearRouteMap();

    if (mapEmptyState) {
      mapEmptyState.style.display = points.length > 0 ? 'none' : '';
    }

    if (!points.length) {
      map.setView([-4.05, -78.92], 12);
      return;
    }

    const latLngs = points.map((point) => [Number(point.lat), Number(point.lon)]);
    routePolyline = window.L.polyline(latLngs, {
      color: '#4ec5ff',
      weight: 4,
      opacity: 0.85
    }).addTo(map);

    const startMarker = window.L.marker(latLngs[0]).addTo(map);
    startMarker.bindPopup('Inicio de la ruta');
    routeMarkers.push(startMarker);

    if (latLngs.length > 1) {
      const endMarker = window.L.marker(latLngs[latLngs.length - 1]).addTo(map);
      endMarker.bindPopup('Fin de la ruta');
      routeMarkers.push(endMarker);
    }

    map.fitBounds(routePolyline.getBounds(), { padding: [24, 24] });
  }

  function populateDevices(devices) {
    currentDevices = devices;
    if (!deviceSelect) {
      return;
    }

    deviceSelect.innerHTML = devices.map((device) => `
      <option value="${device.deviceId}">
        ${(device.vehicleName || device.name || 'Unidad')} | ${device.groupName || 'Sin empresa'}
      </option>
    `).join('');
  }

  async function initializeView() {
    if (!apiClient) {
      return false;
    }

    try {
      const session = await apiClient.getSessionInfo();
      if (!session) {
        sessionTitle.textContent = 'Sin sesion activa';
        sessionText.textContent = 'Inicia sesion desde login.html para consultar rutas reales.';
        renderSummary({ summary: { total: 0, moving: 0 }, points: [] });
        renderPoints([]);
        renderRoute([]);
        return false;
      }

      sessionTitle.textContent = 'Sesion real detectada';
      sessionText.textContent = `SessionId activa: ${session.id}. Lista para consultar recorridos historicos.`;

      const dashboard = await apiClient.getDashboard();
      const devices = Array.isArray(dashboard.devices) ? dashboard.devices : [];
      populateDevices(devices);
      setDefaultRange();
      renderSummary({ summary: { total: 0, moving: 0 }, points: [] });
      renderPoints([]);
      renderRoute([]);
      return devices.length > 0;
    } catch (_error) {
      sessionTitle.textContent = 'No fue posible cargar la vista';
      sessionText.textContent = 'Revisa la sesion, el backend o la conectividad con el portal.';
      renderSummary({ summary: { total: 0, moving: 0 }, points: [] });
      renderPoints([]);
      renderRoute([]);
      return false;
    }
  }

  async function loadRoute() {
    if (!apiClient || !deviceSelect?.value || !fromInput?.value || !toInput?.value) {
      return;
    }

    try {
      signalPill.textContent = 'Consultando...';
      const routeData = await apiClient.getRoute(
        deviceSelect.value,
        new Date(fromInput.value).toISOString(),
        new Date(toInput.value).toISOString()
      );

      renderSummary(routeData || { summary: { total: 0, moving: 0 }, points: [] });
      renderPoints(routeData?.points || []);
      renderRoute(routeData?.points || []);
      signalPill.textContent = routeData?.points?.length ? 'Ruta cargada' : 'Sin puntos';
    } catch (_error) {
      signalPill.textContent = 'Consulta fallida';
      renderSummary({ summary: { total: 0, moving: 0 }, points: [] });
      renderPoints([]);
      renderRoute([]);
    }
  }

  if (loadButton) {
    loadButton.addEventListener('click', loadRoute);
  }

  initializeView();
})();
