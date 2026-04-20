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
  const playButton = document.getElementById('routePlayButton');
  const pauseButton = document.getElementById('routePauseButton');
  const restartButton = document.getElementById('routeRestartButton');
  const speedSelect = document.getElementById('routeSpeedSelect');
  const currentState = document.getElementById('routePlaybackState');
  const currentTime = document.getElementById('routeCurrentTime');
  const currentSpeed = document.getElementById('routeCurrentSpeed');
  const currentPosition = document.getElementById('routeCurrentPosition');
  const currentAddress = document.getElementById('routeCurrentAddress');
  const timelineCount = document.getElementById('routeTimelineCount');

  let routeMap = null;
  let baseLayer = null;
  let routeMarkers = [];
  let routePolyline = null;
  let playbackMarker = null;
  let currentDevices = [];
  let currentRoute = [];
  let playbackIndex = 0;
  let playbackTimer = null;
  let playbackSpeed = Number(speedSelect?.value || 1);
  let isPlaying = false;

  function formatDateTimeLocal(date) {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function formatDateTime(value) {
    if (!value) {
      return '--';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return '--';
    }

    return parsed.toLocaleString();
  }

  function formatShortTime(value) {
    if (!value) {
      return '--:--';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return '--:--';
    }

    return parsed.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatSpeed(value) {
    return `${Math.round(Number(value || 0))} km/h`;
  }

  function formatPosition(point) {
    if (!point || !Number.isFinite(Number(point.lat)) || !Number.isFinite(Number(point.lon))) {
      return 'Sin coordenadas';
    }

    return `${Number(point.lat).toFixed(5)}, ${Number(point.lon).toFixed(5)}`;
  }

  function getAddressLabel(value) {
    return String(value || '').trim() || 'Direccion no disponible para este punto.';
  }

  function getPlaybackInterval() {
    const normalizedSpeed = Math.max(Number(playbackSpeed || 1), 0.5);
    return Math.max(180, Math.round(1100 / normalizedSpeed));
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

    const points = Array.isArray(routeData?.points) ? routeData.points : [];
    const total = Number(routeData?.summary?.total || points.length || 0);
    const moving = Number(routeData?.summary?.moving || 0);
    const first = points[0] || null;
    const last = points[points.length - 1] || null;

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
        <strong>${formatShortTime(first?.fixTime)}</strong>
      </article>
      <article class="mobile-routes-kpi">
        <span>Fin</span>
        <strong>${formatShortTime(last?.fixTime)}</strong>
      </article>
    `;
  }

  function renderCurrentPoint(point, index) {
    const total = currentRoute.length;
    const pointLabel = total > 0 && index >= 0
      ? `Punto ${index + 1} de ${total}`
      : 'Sin playback';

    if (currentState) {
      currentState.textContent = isPlaying
        ? `${pointLabel} | Reproduciendo x${playbackSpeed}`
        : `${pointLabel} | ${total ? 'Listo para reproducir' : 'Carga una ruta para iniciar'}`;
    }

    if (currentTime) {
      currentTime.textContent = formatDateTime(point?.fixTime);
    }

    if (currentSpeed) {
      currentSpeed.textContent = formatSpeed(point?.speedKmh);
    }

    if (currentPosition) {
      currentPosition.textContent = formatPosition(point);
    }

    if (currentAddress) {
      currentAddress.textContent = getAddressLabel(point?.address);
    }

    if (timelineCount) {
      timelineCount.textContent = total ? `${total} puntos sincronizados` : 'Sin puntos cargados';
    }
  }

  function buildPlaybackIcon() {
    return window.L.divIcon({
      className: 'gps-playback-marker',
      html: `
        <div class="gps-playback-marker__shell">
          <span class="gps-playback-marker__pulse"></span>
          <span class="gps-playback-marker__dot"></span>
        </div>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
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

      baseLayer = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      });

      baseLayer.addTo(routeMap);
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

    if (playbackMarker) {
      playbackMarker.remove();
      playbackMarker = null;
    }
  }

  function ensurePlaybackMarker(latLng) {
    if (!routeMap) {
      return null;
    }

    if (!playbackMarker) {
      playbackMarker = window.L.marker(latLng, {
        icon: buildPlaybackIcon(),
        zIndexOffset: 900
      }).addTo(routeMap);
    } else {
      playbackMarker.setLatLng(latLng);
    }

    return playbackMarker;
  }

  function updateTimelineSelection() {
    if (!pointsList) {
      return;
    }

    pointsList.querySelectorAll('[data-route-point-index]').forEach((button) => {
      const isActive = Number(button.getAttribute('data-route-point-index')) === playbackIndex;
      button.classList.toggle('mobile-route-point--active', isActive);
    });
  }

  function seekToPoint(nextIndex, options = {}) {
    if (!currentRoute.length || !routeMap) {
      renderCurrentPoint(null, -1);
      return;
    }

    const boundedIndex = Math.max(0, Math.min(nextIndex, currentRoute.length - 1));
    const point = currentRoute[boundedIndex];
    const latLng = [Number(point.lat), Number(point.lon)];

    playbackIndex = boundedIndex;
    ensurePlaybackMarker(latLng);
    renderCurrentPoint(point, boundedIndex);
    updateTimelineSelection();

    if (options.follow !== false) {
      routeMap.panTo(latLng, {
        animate: true,
        duration: 0.5
      });
    }

    if (playbackMarker) {
      playbackMarker.bindPopup(`
        <div class="gps-popup">
          <strong>${formatShortTime(point.fixTime)}</strong>
          <span>${formatSpeed(point.speedKmh)}</span>
          <span>${getAddressLabel(point.address)}</span>
        </div>
      `);
    }
  }

  function pausePlayback() {
    isPlaying = false;
    if (playbackTimer) {
      window.clearTimeout(playbackTimer);
      playbackTimer = null;
    }
    renderCurrentPoint(currentRoute[playbackIndex] || null, currentRoute.length ? playbackIndex : -1);
  }

  function scheduleNextPlaybackStep() {
    if (!isPlaying || !currentRoute.length) {
      return;
    }

    playbackTimer = window.setTimeout(() => {
      if (!isPlaying) {
        return;
      }

      if (playbackIndex >= currentRoute.length - 1) {
        pausePlayback();
        signalPill.textContent = 'Playback finalizado';
        return;
      }

      seekToPoint(playbackIndex + 1, { follow: true });
      scheduleNextPlaybackStep();
    }, getPlaybackInterval());
  }

  function startPlayback() {
    if (!currentRoute.length) {
      signalPill.textContent = 'No hay puntos para reproducir';
      return;
    }

    if (playbackIndex >= currentRoute.length - 1) {
      seekToPoint(0, { follow: true });
    }

    pausePlayback();
    isPlaying = true;
    signalPill.textContent = `Playback x${playbackSpeed}`;
    renderCurrentPoint(currentRoute[playbackIndex], playbackIndex);
    scheduleNextPlaybackStep();
  }

  function restartPlayback() {
    pausePlayback();
    if (!currentRoute.length) {
      renderCurrentPoint(null, -1);
      return;
    }

    seekToPoint(0, { follow: true });
    signalPill.textContent = 'Playback reiniciado';
  }

  function renderPoints(points) {
    if (!pointsList) {
      return;
    }

    if (!points.length) {
      pointsList.innerHTML = '<div class="mobile-map-empty">La ruta no devolvio puntos para ese rango.</div>';
      updateTimelineSelection();
      return;
    }

    pointsList.innerHTML = points.map((point, index) => `
      <button class="mobile-route-point" type="button" data-route-point-index="${index}">
        <div class="mobile-route-point__main">
          <div class="mobile-route-point__top">
            <strong>Punto ${index + 1}</strong>
            <span class="event-badge event-badge--${Number(point.speedKmh || 0) > 3 ? 'success' : 'muted'}">${formatSpeed(point.speedKmh)}</span>
          </div>
          <span>${formatDateTime(point.fixTime)}</span>
          <small>${getAddressLabel(point.address)}</small>
        </div>
        <div class="mobile-route-point__meta">
          <strong>${formatShortTime(point.fixTime)}</strong>
          <span>${formatPosition(point)}</span>
        </div>
      </button>
    `).join('');

    pointsList.querySelectorAll('[data-route-point-index]').forEach((button) => {
      button.addEventListener('click', () => {
        pausePlayback();
        seekToPoint(Number(button.getAttribute('data-route-point-index') || 0), { follow: true });
        signalPill.textContent = 'Punto enfocado';
      });
    });

    updateTimelineSelection();
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
      renderCurrentPoint(null, -1);
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
    startMarker.bindPopup(`
      <div class="gps-popup">
        <strong>Inicio</strong>
        <span>${formatDateTime(points[0]?.fixTime)}</span>
        <span>${getAddressLabel(points[0]?.address)}</span>
      </div>
    `);
    routeMarkers.push(startMarker);

    const endMarker = window.L.circleMarker(latLngs[latLngs.length - 1], {
      radius: 8,
      color: '#d83d3d',
      weight: 3,
      fillColor: '#ff6b64',
      fillOpacity: 1
    }).addTo(map);
    endMarker.bindPopup(`
      <div class="gps-popup">
        <strong>Fin</strong>
        <span>${formatDateTime(points[points.length - 1]?.fixTime)}</span>
        <span>${getAddressLabel(points[points.length - 1]?.address)}</span>
      </div>
    `);
    routeMarkers.push(endMarker);

    map.fitBounds(routePolyline.getBounds(), { padding: [24, 24] });
    seekToPoint(0, { follow: false });
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
      sessionText.textContent = `SessionId activa: ${session.id}. Lista para consultar historicos y playback.`;

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
      } else {
        renderCurrentPoint(null, -1);
      }
      return devices.length > 0;
    } catch (_error) {
      sessionTitle.textContent = 'No fue posible cargar la vista';
      sessionText.textContent = 'Revisa la sesion, el backend o la conectividad con el portal.';
      renderSummary({ summary: { total: 0, moving: 0 }, points: [] });
      renderPoints([]);
      renderRoute([]);
      renderCurrentPoint(null, -1);
      return false;
    }
  }

  async function loadRoute() {
    if (!apiClient || !deviceSelect?.value || !fromInput?.value || !toInput?.value) {
      return;
    }

    pausePlayback();

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

      currentRoute = Array.isArray(routeData?.points) ? routeData.points : [];
      playbackIndex = 0;

      renderSummary(routeData || { summary: { total: 0, moving: 0 }, points: [] });
      renderPoints(currentRoute);
      renderRoute(currentRoute);
      signalPill.textContent = currentRoute.length ? 'Ruta cargada' : 'Sin puntos';
    } catch (error) {
      currentRoute = [];
      playbackIndex = 0;
      signalPill.textContent = error?.code === 'SESSION_EXPIRED'
        ? 'Sesion expirada durante la consulta'
        : 'Consulta fallida';
      renderSummary({ summary: { total: 0, moving: 0 }, points: [] });
      renderPoints([]);
      renderRoute([]);
      renderCurrentPoint(null, -1);
    }
  }

  loadButton?.addEventListener('click', loadRoute);

  presetButtons.forEach((button) => {
    button.addEventListener('click', () => {
      applyPreset(button.dataset.routePreset || '4h');
    });
  });

  playButton?.addEventListener('click', startPlayback);
  pauseButton?.addEventListener('click', () => {
    pausePlayback();
    signalPill.textContent = currentRoute.length ? 'Playback en pausa' : 'Sin puntos';
  });
  restartButton?.addEventListener('click', restartPlayback);

  speedSelect?.addEventListener('change', () => {
    playbackSpeed = Number(speedSelect.value || 1);
    if (isPlaying) {
      startPlayback();
    } else {
      renderCurrentPoint(currentRoute[playbackIndex] || null, currentRoute.length ? playbackIndex : -1);
    }
  });

  initializeView();
})();
