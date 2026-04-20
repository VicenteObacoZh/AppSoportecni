(function () {
  const apiClient = window.GpsRastreoApi;
  const appShell = window.GpsRastreoShell;

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
  const presetButtons = Array.from(document.querySelectorAll('[data-route-preset]'));

  let routeMap = null;
  let routeMarkers = [];
  let routePolyline = null;
  let currentDevices = [];

  function formatDateTimeLocal(date) {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function applyPreset(preset) {
    const now = new Date();
    let from = new Date(now.getTime() - (4 * 60 * 60 * 1000));
    let to = now;

    if (preset === '1h') {
      from = new Date(now.getTime() - (60 * 60 * 1000));
    } else if (preset === 'today') {
      from = new Date(now);
      from.setHours(0, 0, 0, 0);
    } else if (preset === 'yesterday') {
      from = new Date(now);
      from.setDate(from.getDate() - 1);
      from.setHours(0, 0, 0, 0);
      to = new Date(from);
      to.setHours(23, 59, 0, 0);
    }

    fromInput.value = formatDateTimeLocal(from);
    toInput.value = formatDateTimeLocal(to);
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
      <article class="mobile-routes-kpi">
        <span>Puntos</span>
        <strong>${total}</strong>
      </article>
      <article class="mobile-routes-kpi">
        <span>Movimiento</span>
        <strong>${moving}</strong>
      </article>
      <article class="mobile-routes-kpi">
        <span>Inicio</span>
        <strong>${first?.fixTime ? new Date(first.fixTime).toLocaleTimeString() : '--:--'}</strong>
      </article>
      <article class="mobile-routes-kpi">
        <span>Fin</span>
        <strong>${last?.fixTime ? new Date(last.fixTime).toLocaleTimeString() : '--:--'}</strong>
      </article>
    `;
  }

  function renderPoints(points) {
    if (!pointsList) {
      return;
    }

    if (!points.length) {
      pointsList.innerHTML = '<div class="mobile-map-empty">La ruta no devolvio puntos para ese rango.</div>';
      return;
    }

    pointsList.innerHTML = points.slice(-12).reverse().map((point, index) => `
      <div class="event-row">
        <div class="event-row__top">
          <strong>Punto ${points.length - index}</strong>
          <span class="event-badge event-badge--${Number(point.speedKmh || 0) > 3 ? 'success' : 'muted'}">${Number(point.speedKmh || 0)} km/h</span>
        </div>
        <span>${point.fixTime ? new Date(point.fixTime).toLocaleString() : 'Sin hora visible'}</span>
        <small>${point.address || `${point.lat}, ${point.lon}`}</small>
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
        attributionControl: false
      }).setView([-4.05, -78.92], 6);

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
      map.setView([-4.05, -78.92], 6);
      return;
    }

    const latLngs = points.map((point) => [Number(point.lat), Number(point.lon)]);
    routePolyline = window.L.polyline(latLngs, {
      color: '#1ea1ff',
      weight: 4,
      opacity: 0.85
    }).addTo(map);

    const startMarker = window.L.circleMarker(latLngs[0], {
      radius: 8,
      color: '#2f9d42',
      weight: 3,
      fillColor: '#57c95f',
      fillOpacity: 1
    }).addTo(map);
    startMarker.bindPopup('Inicio');
    routeMarkers.push(startMarker);

    const endMarker = window.L.circleMarker(latLngs[latLngs.length - 1], {
      radius: 8,
      color: '#d83d3d',
      weight: 3,
      fillColor: '#ff6b64',
      fillOpacity: 1
    }).addTo(map);
    endMarker.bindPopup('Fin');
    routeMarkers.push(endMarker);

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

  function restoreRouteContext() {
    const url = new URL(window.location.href);
    const deviceId = url.searchParams.get('deviceId');
    const stored = apiClient?.getRouteContext?.();

    if (stored?.from && stored?.to) {
      fromInput.value = formatDateTimeLocal(new Date(stored.from));
      toInput.value = formatDateTimeLocal(new Date(stored.to));
    } else {
      applyPreset('4h');
    }

    if (deviceId && deviceSelect) {
      deviceSelect.value = deviceId;
    } else if (stored?.deviceId && deviceSelect) {
      deviceSelect.value = String(stored.deviceId);
    }
  }

  async function initializeView() {
    if (!apiClient) {
      return false;
    }

    try {
      const session = await appShell?.requireSession?.({
        redirectOnMissing: true,
        sessionTitleEl: sessionTitle,
        sessionTextEl: sessionText
      });

      if (!session) {
        renderSummary({ summary: { total: 0, moving: 0 }, points: [] });
        renderPoints([]);
        renderRoute([]);
        return false;
      }

      sessionTitle.textContent = session.mode === 'live' ? 'Sesion real detectada' : 'Sesion mock detectada';
      sessionText.textContent = `SessionId activa: ${session.id}. Lista para consultar historicos.`;

      const dashboard = await apiClient.getDashboard();
      const devices = Array.isArray(dashboard.devices) ? dashboard.devices : [];
      populateDevices(devices);
      restoreRouteContext();
      renderSummary({ summary: { total: 0, moving: 0 }, points: [] });
      renderPoints([]);
      renderRoute([]);
      const currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.get('deviceId')) {
        window.setTimeout(() => {
          loadRoute();
        }, 100);
      }
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
      const routeContext = {
        deviceId: deviceSelect.value,
        from: new Date(fromInput.value).toISOString(),
        to: new Date(toInput.value).toISOString()
      };
      apiClient?.storeRouteContext?.(routeContext);

      const routeData = await apiClient.getRoute(
        routeContext.deviceId,
        routeContext.from,
        routeContext.to
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

  loadButton?.addEventListener('click', loadRoute);

  presetButtons.forEach((button) => {
    button.addEventListener('click', () => {
      applyPreset(button.dataset.routePreset || '4h');
    });
  });

  initializeView();
})();
