(function () {
  const apiClient = window.GpsRastreoApi;
  const appShell = window.GpsRastreoShell;

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
  const pageUrl = new URL(window.location.href);

  function buildReturnToDeviceSheetUrl() {
    const deviceId = String(pageUrl.searchParams.get('deviceId') || deviceSelect?.value || '').trim();
    const params = new URLSearchParams();
    if (deviceId) {
      params.set('openSheetDeviceId', deviceId);
    }
    return `./devices.html${params.toString() ? `?${params.toString()}` : ''}`;
  }
  const currentState = document.getElementById('routePlaybackState');
  const currentTime = document.getElementById('routeCurrentTime');
  const currentSpeed = document.getElementById('routeCurrentSpeed');
  const currentPosition = document.getElementById('routeCurrentPosition');
  const currentAddress = document.getElementById('routeCurrentAddress');
  const timelineCount = document.getElementById('routeTimelineCount');
  const playbackSlider = document.getElementById('routePlaybackSlider');
  const deviceTitle = document.getElementById('routeDeviceTitle');
  const backButton = document.getElementById('routeBackButton');
  const filtersButton = document.getElementById('routeFiltersButton');
  const filtersPanel = document.getElementById('routeFiltersPanel');
  const closeFiltersButton = document.getElementById('routeCloseFiltersButton');
  const filtersBackdrop = document.getElementById('routeFiltersBackdrop');
  const applyFiltersButton = document.getElementById('routeApplyFiltersButton');

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
  let routeLoading = true;

  function updateRouteLoadingOverlay(isVisible) {
    routeLoading = Boolean(isVisible);
    if (mapEmptyState) {
      mapEmptyState.style.display = routeLoading ? '' : 'none';
    }
  }

  function syncPlayButtonState() {
    if (!playButton) {
      return;
    }

    playButton.innerHTML = `<span aria-hidden="true">${isPlaying ? '&#10074;&#10074;' : '&#9654;'}</span>`;
  }

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
    return `${Math.round(Number(value || 0))} kph`;
  }

  function formatDistanceKm(value) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return '0 km';
    }

    return `${numeric.toFixed(numeric >= 100 ? 0 : 2)} km`;
  }

  function formatDuration(seconds) {
    const numeric = Math.max(0, Number(seconds || 0));
    const hours = Math.floor(numeric / 3600);
    const minutes = Math.floor((numeric % 3600) / 60);
    const secs = Math.floor(numeric % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}min ${secs}s`;
    }

    if (minutes > 0) {
      return `${minutes}min ${secs}s`;
    }

    return `${secs}s`;
  }

  function formatEventDistanceKm(value) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return '0 km';
    }

    return `${numeric.toFixed(numeric >= 10 ? 1 : 2)} km`;
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

  function compactAddress(value, maxLength = 52) {
    const label = getAddressLabel(value);
    if (label.length <= maxLength) {
      return label;
    }

    return `${label.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
  }

  function toTimestamp(value) {
    const parsed = new Date(value);
    const time = parsed.getTime();
    return Number.isFinite(time) ? time : null;
  }

  function getPointDeltaSeconds(point, nextPoint) {
    const currentTime = toTimestamp(point?.fixTime);
    const nextTime = toTimestamp(nextPoint?.fixTime);
    if (currentTime == null || nextTime == null || nextTime <= currentTime) {
      return 0;
    }

    return Math.round((nextTime - currentTime) / 1000);
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const toRad = (degrees) => (Number(degrees) * Math.PI) / 180;
    const dLat = toRad(Number(lat2) - Number(lat1));
    const dLon = toRad(Number(lon2) - Number(lon1));
    const sourceLat = toRad(lat1);
    const targetLat = toRad(lat2);
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(sourceLat) * Math.cos(targetLat) * Math.sin(dLon / 2) ** 2;
    return 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  function getPointDeltaDistanceKm(point, nextPoint) {
    if (!point || !nextPoint) {
      return 0;
    }

    const lat1 = Number(point.lat);
    const lon1 = Number(point.lon);
    const lat2 = Number(nextPoint.lat);
    const lon2 = Number(nextPoint.lon);
    if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) {
      return 0;
    }

    return haversineKm(lat1, lon1, lat2, lon2);
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
    const maxSpeed = points.reduce((highest, point) => Math.max(highest, Number(point?.speedKmh || 0)), 0);
    const totalDistanceKm = Number(routeData?.summary?.distanceKm || routeData?.summary?.distance || 0);
    const movingSeconds = Number(routeData?.summary?.movingSeconds || routeData?.summary?.durationSeconds || 0);
    const reportSeconds = Number(routeData?.summary?.elapsedSeconds || routeData?.summary?.totalSeconds || 0);

    summary.innerHTML = `
      <article class="mobile-routes-player__metric">
        <span aria-hidden="true">&#127937;</span>
        <div>
          <strong>${Math.round(maxSpeed)} kph</strong>
          <small>Velocidad maxima</small>
        </div>
      </article>
      <article class="mobile-routes-player__metric">
        <span aria-hidden="true">&#10136;</span>
        <div>
          <strong>${formatDistanceKm(totalDistanceKm)}</strong>
          <small>Distancia</small>
        </div>
      </article>
      <article class="mobile-routes-player__metric">
        <span aria-hidden="true">&#128295;</span>
        <div>
          <strong>${formatDuration(movingSeconds)}</strong>
          <small>Conduciendo</small>
        </div>
      </article>
      <article class="mobile-routes-player__metric">
        <span aria-hidden="true">&#9200;</span>
        <div>
          <strong>${formatDuration(reportSeconds || moving)}</strong>
          <small>Reporte</small>
        </div>
      </article>
      <article class="mobile-routes-player__metric">
        <span aria-hidden="true">&#128344;</span>
        <div>
          <strong>${formatShortTime(first?.fixTime)}</strong>
          <small>Inicio</small>
        </div>
      </article>
      <article class="mobile-routes-player__metric">
        <span aria-hidden="true">&#128343;</span>
        <div>
          <strong>${formatShortTime(last?.fixTime)}</strong>
          <small>Fin</small>
        </div>
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

    if (playbackSlider) {
      playbackSlider.max = total > 0 ? String(total - 1) : '0';
      playbackSlider.value = total > 0 && index >= 0 ? String(index) : '0';
    }
  }

  function setSignal(text) {
    if (signalPill) {
      signalPill.textContent = text;
    }
  }

  function openFiltersPanel() {
    if (filtersPanel) {
      filtersPanel.hidden = false;
    }
  }

  function closeFiltersPanel() {
    if (filtersPanel) {
      filtersPanel.hidden = true;
    }
  }

  function buildPlaybackIcon(course = 0) {
    const rotation = Number.isFinite(Number(course)) ? Number(course) : 0;

    return window.L.divIcon({
      className: 'gps-playback-marker',
      html: `
        <div class="gps-playback-marker__shell" style="--playback-course:${rotation}deg;">
          <span class="gps-playback-marker__pulse"></span>
          <img class="gps-playback-marker__image" src="./assets/flecha_verde.png" alt="" />
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });
  }

  function ensureMap() {
    if (!mapElement || typeof window.L === 'undefined') {
      return null;
    }

    if (!routeMap) {
      routeMap = window.L.map(mapElement, {
        zoomControl: false,
        attributionControl: false
      }).setView([-4.05, -78.92], 6);

      window.L.control.zoom({
        position: 'topright'
      }).addTo(routeMap);

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

  function ensurePlaybackMarker(latLng, point = null) {
    if (!routeMap) {
      return null;
    }

    const icon = buildPlaybackIcon(point?.course);

    if (!playbackMarker) {
      playbackMarker = window.L.marker(latLng, {
        icon,
        zIndexOffset: 900
      }).addTo(routeMap);
    } else {
      playbackMarker.setLatLng(latLng);
      playbackMarker.setIcon(icon);
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
    ensurePlaybackMarker(latLng, point);
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
    syncPlayButtonState();
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
        setSignal('Playback finalizado');
        return;
      }

      seekToPoint(playbackIndex + 1, { follow: true });
      scheduleNextPlaybackStep();
    }, getPlaybackInterval());
  }

  function startPlayback() {
    if (!currentRoute.length) {
      setSignal('No hay puntos');
      return;
    }

    if (playbackIndex >= currentRoute.length - 1) {
      seekToPoint(0, { follow: true });
    }

    pausePlayback();
    isPlaying = true;
    syncPlayButtonState();
    setSignal(`Playback x${playbackSpeed}`);
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
    setSignal('Reiniciado');
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

    pointsList.innerHTML = points.map((point, index) => {
      const nextPoint = points[index + 1] || null;
      const deltaSeconds = getPointDeltaSeconds(point, nextPoint);
      const deltaDistanceKm = getPointDeltaDistanceKm(point, nextPoint);
      const isMoving = Number(point.speedKmh || 0) > 3;

      return `
        <button class="mobile-route-point" type="button" data-route-point-index="${index}">
          <div class="mobile-route-point__badge ${isMoving ? 'mobile-route-point__badge--move' : 'mobile-route-point__badge--stop'}">
            ${isMoving ? 'M' : 'P'}
          </div>

          <div class="mobile-route-point__body">
            <div class="mobile-route-point__row">
              <strong>${formatShortTime(point.fixTime)}</strong>
              <span class="mobile-route-point__speed">${formatSpeed(point.speedKmh)}</span>
            </div>
            <div class="mobile-route-point__stats">
              <span>&#128339; ${formatDuration(deltaSeconds)}</span>
              <span>&#128205; ${formatEventDistanceKm(deltaDistanceKm)}</span>
              <span>&#128663; ${formatSpeed(point.speedKmh)}</span>
            </div>
            <div class="mobile-route-point__details">
              <span>${compactAddress(point.address)}</span>
              <small>${formatPosition(point)}</small>
            </div>
          </div>
        </button>
      `;
    }).join('');

    pointsList.querySelectorAll('[data-route-point-index]').forEach((button) => {
      button.addEventListener('click', () => {
        pausePlayback();
        seekToPoint(Number(button.getAttribute('data-route-point-index') || 0), { follow: true });
        setSignal('Punto enfocado');
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

    points.forEach((point) => {
      const marker = window.L.circleMarker([Number(point.lat), Number(point.lon)], {
        radius: 4,
        color: '#ef4444',
        weight: 2,
        fillColor: '#ef4444',
        fillOpacity: 1,
        opacity: 0.95
      }).addTo(map);
      routeMarkers.push(marker);
    });

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

    updateDeviceTitle();
  }

  function updateDeviceTitle() {
    if (!deviceTitle || !deviceSelect) {
      return;
    }

    const option = deviceSelect.options[deviceSelect.selectedIndex];
    const title = option?.textContent?.split('|')[0]?.trim() || 'Reproduccion';
    deviceTitle.textContent = title;
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
        redirectOnMissing: true
      });

      if (!session) {
        updateRouteLoadingOverlay(false);
        renderSummary({ summary: { total: 0, moving: 0 }, points: [] });
        renderPoints([]);
        renderRoute([]);
        return false;
      }

      const dashboard = await apiClient.getDashboard();
      const devices = Array.isArray(dashboard.devices) ? dashboard.devices : [];
      populateDevices(devices);
      restoreRouteContext();
      renderSummary({ summary: { total: 0, moving: 0 }, points: [] });
      renderPoints([]);
      renderRoute([]);
      const currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.get('deviceId')) {
        updateRouteLoadingOverlay(true);
        window.setTimeout(() => {
          loadRoute();
        }, 100);
      } else {
        updateRouteLoadingOverlay(false);
        renderCurrentPoint(null, -1);
      }
      return devices.length > 0;
    } catch (_error) {
      updateRouteLoadingOverlay(false);
      renderSummary({ summary: { total: 0, moving: 0 }, points: [] });
      renderPoints([]);
      renderRoute([]);
      renderCurrentPoint(null, -1);
      return false;
    }
  }

  async function loadRoute() {
    if (!apiClient || !deviceSelect?.value || !fromInput?.value || !toInput?.value) {
      updateRouteLoadingOverlay(false);
      return;
    }

    pausePlayback();

    try {
      updateRouteLoadingOverlay(true);
      setSignal('Consultando...');
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
      updateRouteLoadingOverlay(false);
      updateDeviceTitle();
      setSignal(currentRoute.length ? 'Ruta cargada' : 'Sin puntos');
      closeFiltersPanel();
    } catch (error) {
      updateRouteLoadingOverlay(false);
      currentRoute = [];
      playbackIndex = 0;
      setSignal(error?.code === 'SESSION_EXPIRED'
        ? 'Sesion expirada durante la consulta'
        : 'Consulta fallida');
      renderSummary({ summary: { total: 0, moving: 0 }, points: [] });
      renderPoints([]);
      renderRoute([]);
      renderCurrentPoint(null, -1);
    }
  }

  loadButton?.addEventListener('click', loadRoute);
  backButton?.addEventListener('click', () => {
    const returnTo = String(pageUrl.searchParams.get('returnTo') || '').trim().toLowerCase();
    const from = String(pageUrl.searchParams.get('from') || '').trim().toLowerCase();

    if (returnTo === 'device-sheet' || from === 'devices') {
      window.location.href = buildReturnToDeviceSheetUrl();
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.href = './map.html';
  });

  filtersButton?.addEventListener('click', () => {
    openFiltersPanel();
  });
  closeFiltersButton?.addEventListener('click', closeFiltersPanel);
  filtersBackdrop?.addEventListener('click', closeFiltersPanel);
  applyFiltersButton?.addEventListener('click', loadRoute);

  deviceSelect?.addEventListener('change', updateDeviceTitle);

  presetButtons.forEach((button) => {
    button.addEventListener('click', () => {
      applyPreset(button.dataset.routePreset || '4h');
    });
  });

  playButton?.addEventListener('click', startPlayback);
  pauseButton?.addEventListener('click', () => {
    pausePlayback();
    setSignal(currentRoute.length ? 'Playback en pausa' : 'Sin puntos');
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

  playbackSlider?.addEventListener('touchstart', (event) => {
    event.stopPropagation();
  }, { passive: true });

  playbackSlider?.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
  });

  playbackSlider?.addEventListener('input', () => {
    if (!currentRoute.length) {
      return;
    }

    pausePlayback();
    seekToPoint(Number(playbackSlider.value || 0), { follow: true });
    setSignal('Punto seleccionado');
  });

  syncPlayButtonState();
  initializeView();
})();
