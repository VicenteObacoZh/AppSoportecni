(function () {
  const apiClient = window.GpsRastreoApi;
  const refreshButton = document.getElementById('refreshMapButton');
  const deviceList = document.getElementById('mapDeviceList');
  const companyList = document.getElementById('mapCompanyList');
  const mapElement = document.getElementById('pageLiveMap');
  const mapEmptyState = document.getElementById('pageMapEmptyState');
  const menuButton = document.getElementById('mobileMapMenuButton');
  const sheet = document.getElementById('mobileMapSheet');
  const tabButtons = Array.from(document.querySelectorAll('[data-sheet-tab]'));
  const tabPanels = Array.from(document.querySelectorAll('[data-sheet-panel]'));
  const searchInput = document.getElementById('mapSearchInput');
  const clearSearchButton = document.getElementById('mapSearchClearButton');
  const movingCount = document.getElementById('mapMovingCount');
  const locationCount = document.getElementById('mapLocationCount');
  const alertCount = document.getElementById('mapAlertCount');
  const zoomInButton = document.getElementById('mapZoomInButton');
  const zoomOutButton = document.getElementById('mapZoomOutButton');
  const locateButton = document.getElementById('mapLocateButton');
  const userLocationButton = document.getElementById('mapUserLocationButton');
  const layerButton = document.getElementById('mapLayerButton');
  const layerPanel = document.getElementById('mapLayerPanel');
  const geofencesToggle = document.getElementById('mapGeofencesToggle');
  const geofencesStatus = document.getElementById('mapGeofencesStatus');
  const alertsButton = document.getElementById('mapAlertsButton');
  const routesButton = document.getElementById('mapRoutesButton');
  const geofenceFabButton = document.getElementById('mapGeofenceFabButton');
  const headerTitle = document.getElementById('mapHeaderTitle');
  const backButton = document.getElementById('mapBackButton');
  const eventPanel = document.getElementById('mapEventPanel');
  const eventPanelGrabber = document.getElementById('mapEventPanelGrabber');
  const eventType = document.getElementById('mapEventType');
  const eventSpeed = document.getElementById('mapEventSpeed');
  const eventTime = document.getElementById('mapEventTime');
  const eventAddressButton = document.getElementById('mapEventAddressButton');
  const eventAddressText = document.getElementById('mapEventAddressText');
  const devicePanel = document.getElementById('mapDevicePanel');
  const devicePanelGrabber = document.getElementById('mapDevicePanelGrabber');
  const deviceTitle = document.getElementById('mapDeviceTitle');
  const deviceCompany = document.getElementById('mapDeviceCompany');
  const deviceSpeed = document.getElementById('mapDeviceSpeed');
  const deviceTime = document.getElementById('mapDeviceTime');
  const deviceUniqueId = document.getElementById('mapDeviceUniqueId');
  const deviceStatus = document.getElementById('mapDeviceStatus');
  const deviceAddressButton = document.getElementById('mapDeviceAddressButton');
  const deviceCommandButton = document.getElementById('mapDeviceCommandButton');
  const deviceAddressText = document.getElementById('mapDeviceAddressText');
  const deviceRouteButton = document.getElementById('mapDeviceRouteButton');
  const deviceShareButton = document.getElementById('mapDeviceShareButton');
  const deviceHistoryButton = document.getElementById('mapDeviceHistoryButton');
  const deviceInfoButton = document.getElementById('mapDeviceInfoButton');
  const deviceSensorsList = document.getElementById('mapDeviceSensorsList');
  const infoModal = document.getElementById('mapInfoModal');
  const infoModalBackdrop = document.getElementById('mapInfoModalBackdrop');
  const infoModalClose = document.getElementById('mapInfoModalClose');
  const infoTitle = document.getElementById('mapInfoTitle');
  const infoDistance = document.getElementById('mapInfoDistance');
  const infoMaxSpeed = document.getElementById('mapInfoMaxSpeed');
  const infoFuel = document.getElementById('mapInfoFuel');
  const infoAddressBtn = document.getElementById('mapInfoAddressBtn');
  const infoAddress = document.getElementById('mapInfoAddress');
  const infoRecent = document.getElementById('mapInfoRecent');
  const infoStopDuration = document.getElementById('mapInfoStopDuration');
  const infoDrivers = document.getElementById('mapInfoDrivers');
  const infoSensorDoor = document.getElementById('mapInfoSensorDoor');
  const infoSensorVibration = document.getElementById('mapInfoSensorVibration');
  const infoSensorHours = document.getElementById('mapInfoSensorHours');
  const infoSensorOdometer = document.getElementById('mapInfoSensorOdometer');
  const infoFuelReportBtn = document.getElementById('mapInfoFuelReportBtn');
  const infoActionHistory = document.getElementById('mapInfoActionHistory');
  const infoActionCommand = document.getElementById('mapInfoActionCommand');
  const infoActionReport = document.getElementById('mapInfoActionReport');
  const shareModal = document.getElementById('mapShareModal');
  const shareModalBackdrop = document.getElementById('mapShareModalBackdrop');
  const shareCancelButton = document.getElementById('mapShareCancelButton');
  const shareAcceptButton = document.getElementById('mapShareAcceptButton');
  const shareMessage = document.getElementById('mapShareMessage');
  const historyModal = document.getElementById('mapHistoryModal');
  const historyModalBackdrop = document.getElementById('mapHistoryModalBackdrop');
  const historyCancelButton = document.getElementById('mapHistoryCancelButton');
  const historyAcceptButton = document.getElementById('mapHistoryAcceptButton');
  const historyMessage = document.getElementById('mapHistoryMessage');
  const historyCustomFields = document.getElementById('mapHistoryCustomFields');
  const historyFromDate = document.getElementById('mapHistoryFromDate');
  const historyFromTime = document.getElementById('mapHistoryFromTime');
  const historyToDate = document.getElementById('mapHistoryToDate');
  const historyToTime = document.getElementById('mapHistoryToTime');
  const commandModal = document.getElementById('mapCommandModal');
  const commandModalBackdrop = document.getElementById('mapCommandModalBackdrop');
  const commandModalClose = document.getElementById('mapCommandModalClose');
  const commandDeviceName = document.getElementById('mapCommandDeviceName');
  const commandType = document.getElementById('mapCommandType');
  const commandAuthCode = document.getElementById('mapCommandAuthCode');
  const commandMessage = document.getElementById('mapCommandMessage');
  const commandSendButton = document.getElementById('mapCommandSendButton');
  const commandCancelButton = document.getElementById('mapCommandCancelButton');
  const appShell = window.GpsRastreoShell;

  let liveMap = null;
  let baseLayers = {};
  let activeLayerKey = 'osm';
  let geofenceLayerGroup = null;
  let trailLayerGroup = null;
  let trafficLayer = null;
  let trafficLayerFallback = null;
  let trafficLayerFallback2 = null;
  let trafficLayerPrimaryFailed = false;
  let trafficFallbackFailed = false;
  let userLocationMarker = null;
  let userAccuracyCircle = null;
  let renderMarkers = [];
  let eventFocusMarker = null;
  let currentDevices = [];
  let currentCompanies = [];
  let currentGeofences = [];
  let currentTab = 'devices';
  let activeCompany = '';
  let activeStatusFilter = 'all';
  let currentAlertSummary = null;
  let selectedEvent = null;
  let selectedDevice = null;
  let commandSending = false;
  let autoRefreshTimer = null;
  let hasInitializedViewport = false;
  let geofencesVisible = false;
  let trafficVisible = false;
  let detailedMarkers = new Map();
  let detailedSnapshots = new Map();
  let resolvedAddressByKey = new Map();
  let pendingAddressByKey = new Map();
  let trailPolylineById = new Map();
  let movementHistoryById = new Map();
  let fuelReportByDeviceId = new Map();
  let shareSending = false;
  let historyOpening = false;
  let pendingDeviceAction = '';
  const pageUrl = new URL(window.location.href);

  function buildReturnToDeviceSheetUrl(deviceId) {
    const targetDeviceId = String(deviceId || selectedDevice?.deviceId || '').trim();
    const params = new URLSearchParams();
    if (targetDeviceId) {
      params.set('openSheetDeviceId', targetDeviceId);
    }
    return `./devices.html${params.toString() ? `?${params.toString()}` : ''}`;
  }

  function syncSelectionActionButtons(hasSelectedDevice) {
    const isVisible = Boolean(hasSelectedDevice);
    const targetButtons = [locateButton, routesButton];

    targetButtons.forEach((button) => {
      if (!button) {
        return;
      }
      button.hidden = !isVisible;
      button.classList.toggle('mobile-map-action--hidden', !isVisible);
      button.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
    });
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function formatSpeed(speed) {
    return `${Math.round(Number(speed || 0))} kph`;
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

  function updateMapLoadingOverlay(isVisible) {
    if (!mapEmptyState) {
      return;
    }

    mapEmptyState.style.display = isVisible ? '' : 'none';
  }

  function formatFixAge(value) {
    if (!value) {
      return '--';
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return '--';
    }
    const diffMs = Math.max(0, Date.now() - parsed.getTime());
    const min = Math.floor(diffMs / 60000);
    if (min < 1) {
      return 'hace 1 min';
    }
    if (min < 60) {
      return `hace ${min} min`;
    }
    const hours = Math.floor(min / 60);
    return `hace ${hours} h`;
  }

  function parseFixTime(value) {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function normalizeStatusText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function resolveColorFromText(value) {
    const text = normalizeStatusText(value);
    if (!text) {
      return '';
    }

    if (text.includes('red') || text.includes('rojo')) {
      return 'rojo';
    }
    if (text.includes('green') || text.includes('verde')) {
      return 'verde';
    }
    if (text.includes('yellow') || text.includes('amarillo')) {
      return 'amarillo';
    }
    if (text.includes('gray') || text.includes('grey') || text.includes('gris')) {
      return 'gris';
    }

    return '';
  }

  function resolveExplicitStatusColor(device) {
    const booleanSignals = [
      device?.engineOn,
      device?.EngineOn,
      device?.isEngineOn,
      device?.IsEngineOn,
      device?.ignitionOn,
      device?.IgnitionOn,
      device?.isIgnitionOn,
      device?.IsIgnitionOn
    ];

    for (const signal of booleanSignals) {
      if (typeof signal === 'boolean') {
        return signal ? 'verde' : 'rojo';
      }
      const text = normalizeStatusText(signal);
      if (text === 'true' || text === '1' || text === 'on' || text === 'encendido') {
        return 'verde';
      }
      if (text === 'false' || text === '0' || text === 'off' || text === 'apagado') {
        return 'rojo';
      }
    }

    const explicitColorFields = [
      device?.statusColor,
      device?.StatusColor,
      device?.color,
      device?.Color,
      device?.markerColor,
      device?.MarkerColor,
      device?.iconColor,
      device?.IconColor
    ];

    for (const fieldValue of explicitColorFields) {
      const byColor = resolveColorFromText(fieldValue);
      if (byColor) {
        return byColor;
      }
    }

    const hints = [
      device?.status,
      device?.Status,
      device?.state,
      device?.State,
      device?.movementStatus,
      device?.MovementStatus,
      device?.eventType,
      device?.EventType,
      device?.engineStatus,
      device?.EngineStatus,
      device?.ignition,
      device?.Ignition,
      device?.ignitionStatus,
      device?.IgnitionStatus,
      device?.icon,
      device?.Icon,
      device?.iconName,
      device?.IconName,
      device?.iconPath,
      device?.IconPath,
      device?.markerPath,
      device?.MarkerPath,
      device?.markerIcon,
      device?.MarkerIcon,
      device?.image,
      device?.Image,
      device?.imagen,
      device?.Imagen
    ].map((value) => normalizeStatusText(value)).join(' | ');

    const byHintColor = resolveColorFromText(hints);
    if (byHintColor) {
      return byHintColor;
    }

    if (hints.includes('sin se') || hints.includes('offline')) {
      return 'gris';
    }
    if (
      hints.includes('detenido') ||
      hints.includes('stopped') ||
      hints.includes('ignitionoff') ||
      hints.includes('apagado') ||
      hints.includes('motor off') ||
      hints.includes('motor apagado')
    ) {
      return 'rojo';
    }
    if (
      hints.includes('movimiento') ||
      hints.includes('moving') ||
      hints.includes('ignitionon') ||
      hints.includes('encendido') ||
      hints.includes('motor on') ||
      hints.includes('motor encendido')
    ) {
      return 'verde';
    }

    return '';
  }

  function getStatusColor(device) {
    const explicit = resolveExplicitStatusColor(device);
    if (explicit) {
      return explicit;
    }

    const speed = Number(device?.speedKmh || device?.speed || 0);
    const hasLocation = Number.isFinite(Number(device?.lat)) && Number.isFinite(Number(device?.lon));
    const fixTime = parseFixTime(device?.fixTime);
    const ageHours = fixTime ? Math.abs(Date.now() - fixTime.getTime()) / 36e5 : Number.POSITIVE_INFINITY;

    if (!hasLocation || ageHours > 24) {
      return 'gris';
    }
    if (speed > 3) {
      return 'verde';
    }
    if (speed > 0) {
      return 'amarillo';
    }
    return 'rojo';
  }

  function getStatusTone(device) {
    const color = getStatusColor(device);
    if (color === 'verde') {
      return { label: 'Movimiento', accent: 'green' };
    }
    if (color === 'amarillo') {
      return { label: 'Reposo', accent: 'yellow' };
    }
    if (color === 'gris') {
      return { label: 'Sin señal', accent: 'gray' };
    }
    return { label: 'Detenido', accent: 'red' };
  }

  function getStatusKey(device) {
    const tone = getStatusTone(device);
    if (tone.accent === 'green') {
      return 'moving';
    }
    if (tone.accent === 'yellow') {
      return 'idle';
    }
    if (tone.accent === 'gray') {
      return 'offline';
    }
    return 'stopped';
  }

  function getAddressLabel(value, fallback = null) {
    const primary = String(value || '').trim();
    if (primary && !/^[-\d.]+\s*,\s*[-\d.]+$/.test(primary)) {
      return primary;
    }

    const lat = Number(fallback?.lat ?? fallback?.latitude ?? fallback?.Lat ?? fallback?.Latitude);
    const lon = Number(fallback?.lon ?? fallback?.longitude ?? fallback?.Lon ?? fallback?.Longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return 'Obteniendo direccion...';
    }

    return 'Obteniendo direccion...';
  }

  function formatCourse(device) {
    const course = Number(device?.course ?? device?.heading ?? device?.direction);
    if (!Number.isFinite(course)) {
      return 'Curso --';
    }
    return `Curso ${Math.round(course)}`;
  }

  function sensorValue(device, keys, fallback = '-') {
    for (const key of keys) {
      const value = device?.[key];
      if (value === null || value === undefined || value === '') {
        continue;
      }
      return String(value);
    }
    return fallback;
  }

  function renderSensorRows(device, statusLabel) {
    if (!deviceSensorsList) {
      return;
    }

    const rows = [
      { icon: '🔌', name: 'Encendido', value: statusLabel === 'Detenido' ? 'Apagado' : 'Encendido' },
      { icon: '⏱', name: 'Horas Motor', value: formatEngineHours(pickValue(device, ['hoursMotor', 'engineHours', 'horasMotor', 'horasMotorInicial'])) },
      { icon: '📳', name: 'Vibracion', value: sensorValue(device, ['vibration', 'vibracion'], '-') },
      { icon: '🛣', name: 'Kilometraje', value: formatOdometerKm(pickValue(device, ['odometer', 'mileage', 'kilometraje', 'odometroInicialKm'])) },
      { icon: '📶', name: 'Conectado', value: formatFixAge(device?.fixTime) === '--' ? 'Sin dato' : 'Conectado' },
      { icon: '🛰', name: 'Satelites', value: sensorValue(device, ['satellites', 'sats'], '-') }
    ];

    deviceSensorsList.innerHTML = rows
      .map((row) => `<p><span>${row.icon} ${escapeHtml(row.name)}</span><strong>${escapeHtml(row.value)}</strong></p>`)
      .join('');
  }

  function initializePanelHeight(panel, compactHeightPx = 220) {
    if (!panel) {
      return;
    }
    panel.classList.add('mobile-map-panel--compact');
    panel.classList.remove('mobile-map-panel--expanded');
    panel.style.maxHeight = `${compactHeightPx}px`;
  }

  function setupDraggablePanel(panel, grabber) {
    if (!panel || !grabber) {
      return;
    }

    let dragging = false;
    let startY = 0;
    let startHeight = 0;
    let activePointerId = null;

    const minHeight = 116;
    const maxHeight = () => Math.round(window.innerHeight * 0.92);

    function applyHeight(heightPx) {
      const clamped = Math.max(minHeight, Math.min(maxHeight(), Math.round(heightPx)));
      panel.style.maxHeight = `${clamped}px`;
      const expanded = clamped > 280;
      panel.classList.toggle('mobile-map-panel--expanded', expanded);
      panel.classList.toggle('mobile-map-panel--compact', !expanded);
    }

    function onMove(clientY) {
      if (!dragging) {
        return;
      }
      const delta = startY - clientY;
      applyHeight(startHeight + delta);
    }

    function stopDrag() {
      dragging = false;
      activePointerId = null;
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerEnd);
      document.removeEventListener('pointercancel', onPointerEnd);
    }

    function startDrag(clientY, pointerId) {
      dragging = true;
      startY = clientY;
      startHeight = panel.getBoundingClientRect().height;
      activePointerId = pointerId;
      document.addEventListener('pointermove', onPointerMove, { passive: false });
      document.addEventListener('pointerup', onPointerEnd);
      document.addEventListener('pointercancel', onPointerEnd);
    }

    function onPointerMove(event) {
      if (!dragging || activePointerId === null || event.pointerId !== activePointerId) {
        return;
      }
      event.preventDefault();
      onMove(event.clientY);
    }

    function onPointerEnd(event) {
      if (activePointerId !== null && event.pointerId !== activePointerId) {
        return;
      }
      stopDrag();
    }

    function bindPointerDragStart(target) {
      if (!target) {
        return;
      }
      target.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) {
          return;
        }
        event.preventDefault();
        startDrag(event.clientY, event.pointerId);
      }, { passive: false });
    }

    bindPointerDragStart(grabber);

    grabber.addEventListener('click', () => {
      const currentHeight = panel.getBoundingClientRect().height;
      const target = currentHeight > 280 ? minHeight : maxHeight();
      applyHeight(target);
    });
  }

  function getAddressKey(deviceLike) {
    const lat = Number(deviceLike?.lat ?? deviceLike?.latitude ?? deviceLike?.Lat ?? deviceLike?.Latitude);
    const lon = Number(deviceLike?.lon ?? deviceLike?.longitude ?? deviceLike?.Lon ?? deviceLike?.Longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }
    return `${lat.toFixed(5)},${lon.toFixed(5)}`;
  }

  function applyResolvedAddressToState(targetLike, address) {
    if (!address) {
      return;
    }
    targetLike.address = address;

    const key = getAddressKey(targetLike);
    if (key) {
      resolvedAddressByKey.set(key, address);
    }

    currentDevices.forEach((item) => {
      const itemKey = getAddressKey(item);
      if (itemKey && itemKey === key) {
        item.address = address;
      }
    });

    if (selectedDevice) {
      const selectedKey = getAddressKey(selectedDevice);
      if (selectedKey && selectedKey === key) {
        selectedDevice.address = address;
      }
    }
  }

  function updateSelectedDeviceAddressView() {
    if (!selectedDevice) {
      return;
    }

    if (deviceCompany) {
      deviceCompany.textContent = getAddressLabel(selectedDevice.address, selectedDevice);
    }
    if (deviceAddressText && !deviceAddressText.hidden) {
      deviceAddressText.textContent = getAddressLabel(selectedDevice.address, selectedDevice);
    }
  }

  async function resolveAddressNowIfNeeded(deviceLike) {
    const key = getAddressKey(deviceLike);
    if (!key) {
      return null;
    }

    if (resolvedAddressByKey.has(key)) {
      return resolvedAddressByKey.get(key);
    }

    if (pendingAddressByKey.has(key)) {
      return pendingAddressByKey.get(key);
    }

    const promise = (async () => {
      const lat = Number(deviceLike?.lat ?? deviceLike?.latitude ?? deviceLike?.Lat ?? deviceLike?.Latitude);
      const lon = Number(deviceLike?.lon ?? deviceLike?.longitude ?? deviceLike?.Lon ?? deviceLike?.Longitude);
      const address = await apiClient?.reverseGeocode?.(lat, lon);
      if (address) {
        applyResolvedAddressToState(deviceLike, address);
        updateSelectedDeviceAddressView();
      }
      return address || null;
    })();

    pendingAddressByKey.set(key, promise);
    try {
      return await promise;
    } finally {
      pendingAddressByKey.delete(key);
    }
  }

  function getFriendlyEventLabel(value) {
    const eventTypeRaw = String(value || '').trim();
    const eventType = eventTypeRaw.toUpperCase();
    if (eventType.includes('IGNITIONON') || eventType.includes('ENCENDIDO')) {
      return 'Encendido de motor';
    }
    if (eventType.includes('IGNITIONOFF') || eventType.includes('APAGADO')) {
      return 'Apagado de motor';
    }
    if (eventType.includes('DEVICEMOVING') || eventType.includes('MOVING') || eventType.includes('MOVIMIENTO')) {
      return 'En movimiento';
    }
    if (eventType.includes('DEVICESTOPPED') || eventType.includes('STOPPED') || eventType.includes('DETENIDO')) {
      return 'Detenido';
    }
    return eventTypeRaw || 'Evento';
  }

  function getMarkerBase(device) {
    return String(device?.iconBase || 'flecha').trim() || 'flecha';
  }

  function getMarkerUrl(device) {
    return `../assets/markers/${getMarkerBase(device)}_${getStatusColor(device)}.png`;
  }

  function setSheetOpen(isOpen) {
    if (!sheet || !menuButton) {
      return;
    }
    sheet.classList.toggle('mobile-map-sheet--open', isOpen);
    menuButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }

  function switchTab(nextTab) {
    currentTab = nextTab;
    tabButtons.forEach((button) => {
      button.classList.toggle('mobile-map-sheet__tab--active', button.dataset.sheetTab === nextTab);
    });
    tabPanels.forEach((panel) => {
      panel.classList.toggle('mobile-map-sheet__panel--active', panel.dataset.sheetPanel === nextTab);
    });
  }

  function setLayerPanelOpen(isOpen) {
    if (!layerPanel || !layerButton) {
      return;
    }

    layerPanel.hidden = !isOpen;
    layerButton.classList.toggle('mobile-map-action--active', isOpen);
  }

  function ensureMap() {
    if (!mapElement || typeof window.L === 'undefined') {
      return null;
    }

    if (!liveMap) {
      liveMap = window.L.map(mapElement, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false
      }).setView([-4.05, -78.92], 6);

      baseLayers = {
        osm: window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap'
        }),
        light: window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 20,
          attribution: '&copy; OpenStreetMap & Carto'
        }),
        terrain: window.L.tileLayer('https://tile.opentopomap.org/{z}/{x}/{y}.png', {
          maxZoom: 17,
          attribution: '&copy; OpenTopoMap'
        })
      };

      baseLayers[activeLayerKey].addTo(liveMap);
      geofenceLayerGroup = window.L.layerGroup().addTo(liveMap);
      trailLayerGroup = window.L.layerGroup().addTo(liveMap);
      trafficLayer = window.L.tileLayer('https://traffic.arcgis.com/arcgis/rest/services/World/Traffic/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        opacity: 0.9
      });
      trafficLayerFallback = window.L.tileLayer('https://mt1.google.com/vt/lyrs=h,traffic&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        opacity: 0.9
      });
      trafficLayerFallback2 = window.L.tileLayer('https://core-renderer-tiles.maps.yandex.net/tiles?l=trf,trfe&x={x}&y={y}&z={z}&scale=1&lang=es_ES', {
        maxZoom: 19,
        opacity: 0.9
      });
      trafficLayer.on('tileerror', () => {
        trafficLayerPrimaryFailed = true;
        if (trafficVisible && liveMap) {
          if (liveMap.hasLayer(trafficLayer)) {
            liveMap.removeLayer(trafficLayer);
          }
          if (trafficLayerFallback && !liveMap.hasLayer(trafficLayerFallback)) {
            trafficLayerFallback.addTo(liveMap);
          }
        }
      });
      trafficLayerFallback.on('tileerror', () => {
        trafficFallbackFailed = true;
        if (trafficVisible && liveMap) {
          if (liveMap.hasLayer(trafficLayerFallback)) {
            liveMap.removeLayer(trafficLayerFallback);
          }
          if (trafficLayerFallback2 && !liveMap.hasLayer(trafficLayerFallback2)) {
            trafficLayerFallback2.addTo(liveMap);
          }
        }
      });

      liveMap.on('zoomend moveend', () => {
        renderMap(filterDevices());
      });

    }

    return liveMap;
  }

  function clearMapMarkers() {
    if (!liveMap) {
      return;
    }

    renderMarkers.forEach((marker) => marker.remove());
    renderMarkers = [];
  }

  function clearDetailedMarkers() {
    detailedMarkers.forEach((marker) => marker.remove());
    detailedMarkers = new Map();
    detailedSnapshots = new Map();
    clearTrails(false);
  }

  function clearTrails(clearHistory = false) {
    trailPolylineById.forEach((polyline) => polyline.remove());
    trailPolylineById = new Map();

    if (trailLayerGroup) {
      trailLayerGroup.clearLayers();
    }

    if (clearHistory) {
      movementHistoryById = new Map();
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    autoRefreshTimer = window.setInterval(() => {
      if (document.hidden) {
        return;
      }
      loadMapPage({ preserveViewport: true, silentRefresh: true });
    }, 8000);
  }

  function stopAutoRefresh() {
    if (autoRefreshTimer) {
      window.clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
  }

  function distanceMeters(aLat, aLon, bLat, bLon) {
    const toRad = (value) => (value * Math.PI) / 180;
    const earthRadius = 6371000;
    const dLat = toRad(bLat - aLat);
    const dLon = toRad(bLon - aLon);
    const lat1 = toRad(aLat);
    const lat2 = toRad(bLat);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const h = (sinDLat * sinDLat) + (Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon);
    return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function clearEventFocusMarker() {
    if (eventFocusMarker) {
      eventFocusMarker.remove();
      eventFocusMarker = null;
    }
  }

  function findNearestDeviceAtLatLng(latlng, maxDistancePx = 34) {
    if (!liveMap || !latlng) {
      return null;
    }

    const tapPoint = liveMap.latLngToContainerPoint(latlng);
    let bestDevice = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    const devices = filterDevices();

    devices.forEach((device) => {
      const lat = Number(device?.lat);
      const lon = Number(device?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return;
      }

      const point = liveMap.latLngToContainerPoint([lat, lon]);
      const dx = point.x - tapPoint.x;
      const dy = point.y - tapPoint.y;
      const distance = Math.hypot(dx, dy);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestDevice = device;
      }
    });

    if (bestDistance <= maxDistancePx) {
      return bestDevice;
    }

    return null;
  }

  function bindMapTapSelection() {
    if (!liveMap || liveMap.__tapSelectionBound) {
      return;
    }

    liveMap.__tapSelectionBound = true;
    liveMap.on('click', (event) => {
      if (selectedEvent) {
        return;
      }
      const nearest = findNearestDeviceAtLatLng(event?.latlng, 34);
      if (nearest) {
        selectDeviceFromMap(nearest);
        return;
      }

      // Tap sobre mapa vacio: limpiar seleccion para volver al estado inicial (7 botones).
      apiClient?.clearSelectedDevice?.();
      showDevicePanel(null);
    });
  }

  function switchBaseLayer(nextKey) {
    if (!liveMap || !baseLayers[nextKey] || nextKey === activeLayerKey) {
      return;
    }

    if (baseLayers[activeLayerKey]) {
      liveMap.removeLayer(baseLayers[activeLayerKey]);
    }

    activeLayerKey = nextKey;
    baseLayers[activeLayerKey].addTo(liveMap);

    document.querySelectorAll('[data-map-layer]').forEach((button) => {
      button.classList.toggle('mobile-map-layer-chip--active', button.dataset.mapLayer === nextKey);
    });
  }

  function updateGeofencesStatus(text) {
    if (geofencesStatus) {
      geofencesStatus.textContent = text;
    }
  }

  function syncGeofenceFabState() {
    if (!geofenceFabButton) {
      return;
    }
    geofenceFabButton.classList.toggle('mobile-map-action--geofence-on', geofencesVisible);
  }

  function syncGeofencesControls() {
    if (geofencesToggle) {
      geofencesToggle.textContent = geofencesVisible ? 'Ocultar geocercas' : 'Mostrar geocercas';
    }
    syncGeofenceFabState();
  }

  function syncTrafficButtonState() {
    alertsButton?.classList.toggle('mobile-map-action--active', trafficVisible);
  }

  function setTrafficVisible(isVisible) {
    trafficVisible = Boolean(isVisible);
    if (liveMap && trafficLayer) {
      if (trafficVisible) {
        if (!trafficLayerPrimaryFailed) {
          if (!liveMap.hasLayer(trafficLayer)) {
            trafficLayer.addTo(liveMap);
          }
          if (trafficLayerFallback && liveMap.hasLayer(trafficLayerFallback)) {
            liveMap.removeLayer(trafficLayerFallback);
          }
          if (trafficLayerFallback2 && liveMap.hasLayer(trafficLayerFallback2)) {
            liveMap.removeLayer(trafficLayerFallback2);
          }
        } else if (!trafficFallbackFailed && trafficLayerFallback) {
          if (!liveMap.hasLayer(trafficLayerFallback)) {
            trafficLayerFallback.addTo(liveMap);
          }
          if (liveMap.hasLayer(trafficLayer)) {
            liveMap.removeLayer(trafficLayer);
          }
          if (trafficLayerFallback2 && liveMap.hasLayer(trafficLayerFallback2)) {
            liveMap.removeLayer(trafficLayerFallback2);
          }
        } else if (trafficLayerFallback2 && !liveMap.hasLayer(trafficLayerFallback2)) {
          trafficLayerFallback2.addTo(liveMap);
          if (liveMap.hasLayer(trafficLayer)) {
            liveMap.removeLayer(trafficLayer);
          }
          if (trafficLayerFallback && liveMap.hasLayer(trafficLayerFallback)) {
            liveMap.removeLayer(trafficLayerFallback);
          }
        }
      } else {
        if (liveMap.hasLayer(trafficLayer)) {
          liveMap.removeLayer(trafficLayer);
        }
        if (trafficLayerFallback && liveMap.hasLayer(trafficLayerFallback)) {
          liveMap.removeLayer(trafficLayerFallback);
        }
        if (trafficLayerFallback2 && liveMap.hasLayer(trafficLayerFallback2)) {
          liveMap.removeLayer(trafficLayerFallback2);
        }
      }
    }
    syncTrafficButtonState();
  }

  function renderGeofences() {
    if (!geofenceLayerGroup) {
      return;
    }

    geofenceLayerGroup.clearLayers();

    if (!geofencesVisible) {
      updateGeofencesStatus(currentGeofences.length ? 'Geocercas ocultas.' : 'Sin geocercas disponibles.');
      return;
    }

    if (!currentGeofences.length) {
      updateGeofencesStatus('Sin geocercas disponibles para esta sesion.');
      return;
    }

    currentGeofences.forEach((geofence) => {
      if (geofence.type === 'polygon' && Array.isArray(geofence.points)) {
        window.L.polygon(
          geofence.points.map((point) => [Number(point.lat), Number(point.lon)]),
          {
            color: '#2f89d9',
            weight: 2,
            fillColor: '#4ec5ff',
            fillOpacity: 0.12
          }
        )
          .bindPopup(`<strong>${escapeHtml(geofence.name || 'Geocerca')}</strong>`)
          .addTo(geofenceLayerGroup);
        return;
      }

      if (Number.isFinite(Number(geofence.centerLat)) && Number.isFinite(Number(geofence.centerLon)) && Number(geofence.radiusMeters) > 0) {
        window.L.circle([Number(geofence.centerLat), Number(geofence.centerLon)], {
          radius: Number(geofence.radiusMeters),
          color: '#2f89d9',
          weight: 2,
          fillColor: '#4ec5ff',
          fillOpacity: 0.12
        })
          .bindPopup(`<strong>${escapeHtml(geofence.name || 'Geocerca')}</strong>`)
          .addTo(geofenceLayerGroup);
      }
    });

    updateGeofencesStatus(`${currentGeofences.length} geocerca(s) visibles.`);
  }

  function showDevicePanel(device) {
    selectedDevice = device || null;
    syncSelectionActionButtons(Boolean(selectedDevice));
    if (!devicePanel) {
      return;
    }
    const wasHidden = Boolean(devicePanel.hidden);

    const hasDevice = Boolean(device);
    devicePanel.hidden = !hasDevice;

    if (!hasDevice) {
      if (deviceAddressText) {
        deviceAddressText.hidden = true;
      }
      return;
    }
    if (wasHidden) {
      initializePanelHeight(devicePanel, 116);
    }

    const status = getStatusTone(device);

    if (deviceTitle) {
      deviceTitle.textContent = device.vehicleName || device.name || 'Unidad';
    }
    if (deviceCompany) {
      deviceCompany.textContent = getAddressLabel(device.address, device);
    }
    if (deviceSpeed) {
      deviceSpeed.textContent = formatSpeed(device.speedKmh);
    }
    if (deviceTime) {
      deviceTime.textContent = formatDateTime(device.fixTime);
    }
    if (deviceUniqueId) {
      deviceUniqueId.textContent = formatCourse(device);
    }
    if (deviceStatus) {
      deviceStatus.textContent = status.label;
    }
    if (deviceAddressText) {
      deviceAddressText.textContent = getAddressLabel(device.address, device);
      deviceAddressText.hidden = true;
    }

    renderSensorRows(device, status.label);

    resolveAddressNowIfNeeded(device).then((resolved) => {
      if (resolved && selectedDevice && getAddressKey(selectedDevice) === getAddressKey(device)) {
        if (deviceCompany) {
          deviceCompany.textContent = resolved;
        }
        if (deviceAddressText) {
          deviceAddressText.textContent = resolved;
        }
      }
    });
  }

  function toNumberOrNull(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function getValueByPath(source, path) {
    if (!source || !path) {
      return undefined;
    }

    const segments = String(path)
      .split('.')
      .map((item) => item.trim())
      .filter(Boolean);

    let current = source;
    for (const segment of segments) {
      if (current == null || typeof current !== 'object' || !(segment in current)) {
        return undefined;
      }
      current = current[segment];
    }

    return current;
  }

  function pickValue(source, keys, fallback = null) {
    if (!source || !Array.isArray(keys)) {
      return fallback;
    }

    for (const key of keys) {
      const value = getValueByPath(source, key);
      if (value !== null && value !== undefined && value !== '') {
        return value;
      }
    }

    return fallback;
  }

  function formatCompactNumber(value, digits = 2) {
    const numeric = toNumberOrNull(value);
    if (numeric === null) {
      return null;
    }

    return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(digits).replace(/\.?0+$/, '');
  }

  function extractFuelInfo(device) {
    const rawFuel = pickValue(device, [
      'fuelToday',
      'fuel',
      'combustible',
      'fuelInfo',
      'dailyFuel',
      'fuelSummary',
      'summary.fuel',
      'summary.combustible',
      'report.fuel',
      'report.combustible'
    ]);

    const directConsumption = pickValue(device, [
      'fuelConsumption',
      'consumoCombustible',
      'combustibleConsumido',
      'consumo',
      'fuel.consumption',
      'fuelConsumptionToday',
      'fuelToday.consumption',
      'combustible.consumption',
      'dailyFuel.consumption',
      'fuelSummary.consumption',
      'summary.fuelConsumption',
      'report.fuelConsumption'
    ]);

    const directLevel = pickValue(device, [
      'fuelLevel',
      'fuelPercent',
      'combustibleNivel',
      'fuel.level',
      'fuel.percent',
      'combustible.level',
      'dailyFuel.level',
      'fuelSummary.level'
    ]);

    const unit = pickValue(device, [
      'fuelUnit',
      'fuel.unit',
      'combustible.unit',
      'dailyFuel.unit',
      'fuelSummary.unit'
    ]);

    if (rawFuel && typeof rawFuel === 'object' && !Array.isArray(rawFuel)) {
      const consumption = pickValue(rawFuel, [
        'consumption', 'consumo', 'used', 'usedToday', 'value', 'amount', 'total'
      ], directConsumption);
      const level = pickValue(rawFuel, [
        'level', 'percentage', 'percent', 'fuelLevel', 'fuelPercent'
      ], directLevel);
      const localUnit = pickValue(rawFuel, ['unit', 'unidad'], unit);

      return {
        raw: rawFuel,
        consumption,
        level,
        unit: localUnit
      };
    }

    return {
      raw: rawFuel,
      consumption: directConsumption,
      level: directLevel,
      unit
    };
  }

  function formatFuelValue(device) {
    const info = extractFuelInfo(device);

    const consumptionText = formatCompactNumber(info.consumption);
    if (consumptionText !== null) {
      const unit = String(info.unit || '').trim() || 'L';
      return `${consumptionText} ${unit}`;
    }

    const levelNumeric = toNumberOrNull(info.level);
    if (levelNumeric !== null) {
      return `${Math.round(levelNumeric)}%`;
    }

    if (info.raw !== null && info.raw !== undefined && info.raw !== '') {
      if (typeof info.raw === 'object') {
        const label = pickValue(info.raw, ['label', 'text', 'display']);
        return label ? String(label) : '-';
      }

      return String(info.raw);
    }

    return '-';
  }

  function formatFuelReportValue(report) {
    const liters = toNumberOrNull(report?.totalLiters);
    const gallons = toNumberOrNull(report?.totalGallons);

    if (liters === null && gallons === null) {
      return '-';
    }

    const resolvedGallons = gallons ?? (liters === null ? null : liters * 0.264172);
    if (liters !== null && resolvedGallons !== null) {
      return `${formatCompactNumber(liters, 2)} L / ${formatCompactNumber(resolvedGallons, 2)} gal`;
    }
    if (liters !== null) {
      return `${formatCompactNumber(liters, 2)} L`;
    }

    return `${formatCompactNumber(resolvedGallons, 2)} gal`;
  }

  function buildCurrentDayFuelRange(referenceValue) {
    const parsed = referenceValue ? new Date(referenceValue) : new Date();
    const base = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
    const end = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59, 59, 999);

    return {
      from: start.toISOString(),
      to: end.toISOString()
    };
  }

  function formatFuelReportMessage(device) {
    const fuelReport = device?.fuelReportToday || fuelReportByDeviceId.get(String(device?.deviceId || ''));
    if (fuelReport) {
      const reportLines = [];
      const reportFuelValue = formatFuelReportValue(fuelReport);

      if (reportFuelValue !== '-') {
        reportLines.push(`Combustible: ${reportFuelValue}`);
      }
      if (fuelReport.detail?.distanceKm != null) {
        reportLines.push(`Distancia: ${formatDistanceKm(fuelReport.detail.distanceKm)}`);
      }
      if (fuelReport.detail?.averageSpeedKph != null) {
        reportLines.push(`Velocidad promedio: ${formatSpeedKph(fuelReport.detail.averageSpeedKph)}`);
      }
      if (fuelReport.modeLabel) {
        reportLines.push(`Modo: ${fuelReport.modeLabel}`);
      }
      if (fuelReport.rangeLabel) {
        reportLines.push(`Rango: ${fuelReport.rangeLabel}`);
      }

      if (reportLines.length) {
        return reportLines.join('\n');
      }
    }

    const info = extractFuelInfo(device);
    const lines = [];

    const fuelValue = formatFuelValue(device);
    if (fuelValue !== '-') {
      lines.push(`Combustible: ${fuelValue}`);
    }

    const levelNumeric = toNumberOrNull(info.level);
    if (levelNumeric !== null && !fuelValue.endsWith('%')) {
      lines.push(`Nivel: ${Math.round(levelNumeric)}%`);
    }

    const extraDistance = pickValue(device, [
      'distanceTodayKm', 'todayDistanceKm', 'dailyDistanceKm', 'distanceKmToday', 'distanceToday', 'distanceKm'
    ]);
    const distanceText = formatDistanceKm(extraDistance);
    if (distanceText !== '-') {
      lines.push(`Distancia: ${distanceText}`);
    }

    const odometerText = formatOdometerKm(pickValue(device, [
      'odometer', 'mileage', 'kilometraje', 'odometroInicialKm'
    ]));
    if (odometerText !== '-') {
      lines.push(`Kilometraje: ${odometerText}`);
    }

    const hoursText = formatEngineHours(pickValue(device, [
      'hoursMotor', 'engineHours', 'horasMotor', 'horasMotorInicial'
    ]));
    if (hoursText !== '-') {
      lines.push(`Horas motor: ${hoursText}`);
    }

    const vin = pickValue(device, ['chasisVin', 'vin', 'chassis', 'uniqueId']);
    if (vin) {
      lines.push(`Identificacion: ${vin}`);
    }

    const status = pickValue(device, ['estadoPortal', 'status', 'estado']);
    if (status) {
      lines.push(`Estado: ${status}`);
    }

    return lines.length ? lines.join('\n') : 'No hay datos de combustible disponibles para esta unidad.';
  }

  function formatDistanceKm(value) {
    const num = toNumberOrNull(value);
    if (num === null) {
      return '-';
    }
    return `${num.toFixed(2)} km`;
  }

  function formatOdometerKm(value) {
    const num = toNumberOrNull(value);
    if (num === null) {
      return '-';
    }
    return `${formatCompactNumber(num, 1)} km`;
  }

  function formatEngineHours(value) {
    const num = toNumberOrNull(value);
    if (num === null) {
      return '-';
    }
    return `${formatCompactNumber(num, 1)} h`;
  }

  function formatSpeedKph(value) {
    const num = toNumberOrNull(value);
    if (num === null) {
      return '-';
    }
    return `${Math.round(num)} kph`;
  }

  function formatDurationCompact(value) {
    const numeric = toNumberOrNull(value);
    if (numeric === null) {
      return '-';
    }

    if (numeric >= 3600) {
      const hours = Math.floor(numeric / 3600);
      const mins = Math.floor((numeric % 3600) / 60);
      return `${hours}h ${mins}m`;
    }

    if (numeric >= 60) {
      return `${Math.floor(numeric / 60)}m`;
    }

    return `${Math.floor(numeric)}s`;
  }

  async function openInfoModal() {
    if (!infoModal) {
      return;
    }

    if (!selectedDevice) {
      window.alert('Primero selecciona una unidad en el mapa.');
      return;
    }

    const device = selectedDevice;
    const deviceKey = String(device.deviceId || '');
    const deviceName = device.vehicleName || device.name || `ID ${device.deviceId || '-'}`;
    const cachedFuelReport = fuelReportByDeviceId.get(deviceKey) || device.fuelReportToday || null;

    if (infoTitle) {
      infoTitle.textContent = deviceName;
    }

    const distanceToday = pickValue(device, [
      'distanceTodayKm', 'todayDistanceKm', 'dailyDistanceKm', 'distanceKmToday', 'distanceToday', 'distanceKm'
    ]);
    const maxSpeedToday = pickValue(device, [
      'maxSpeedToday', 'maxSpeedKphToday', 'vMaxToday', 'speedMaxToday', 'speedMax'
    ], device.speedKmh);
    const recentConnection = pickValue(device, ['fixTime', 'deviceTime', 'serverTime']);
    const stopDurationValue = pickValue(device, [
      'stopDurationSeconds', 'stopDurationSec', 'stopDuration', 'parkingDurationSeconds'
    ]);
    const driverName = pickValue(device, ['driverName', 'driver', 'conductor'], '-');
    const addressText = getAddressLabel(device.address, device);

    if (infoDistance) {
      infoDistance.textContent = cachedFuelReport?.detail?.distanceKm != null
        ? formatDistanceKm(cachedFuelReport.detail.distanceKm)
        : formatDistanceKm(distanceToday);
    }
    if (infoMaxSpeed) {
      infoMaxSpeed.textContent = formatSpeedKph(maxSpeedToday);
    }
    if (infoFuel) {
      infoFuel.textContent = cachedFuelReport ? formatFuelReportValue(cachedFuelReport) : formatFuelValue(device);
    }
    if (infoRecent) {
      infoRecent.textContent = formatDateTime(recentConnection);
    }
    if (infoStopDuration) {
      infoStopDuration.textContent = formatDurationCompact(stopDurationValue);
    }
    if (infoDrivers) {
      infoDrivers.textContent = String(driverName || '-');
    }
    if (infoAddress) {
      infoAddress.textContent = addressText;
      infoAddress.hidden = true;
    }

    if (infoSensorDoor) {
      infoSensorDoor.textContent = sensorValue(device, ['door', 'puerta', 'doorState'], '-');
    }
    if (infoSensorVibration) {
      infoSensorVibration.textContent = sensorValue(device, ['vibration', 'vibracion'], '-');
    }
    if (infoSensorHours) {
      infoSensorHours.textContent = formatEngineHours(
        pickValue(device, ['hoursMotor', 'engineHours', 'horasMotor', 'horasMotorInicial'])
      );
    }
    if (infoSensorOdometer) {
      infoSensorOdometer.textContent = formatOdometerKm(
        pickValue(device, ['odometer', 'mileage', 'kilometraje', 'odometroInicialKm'])
      );
    }

    resolveAddressNowIfNeeded(device).then((resolved) => {
      if (resolved && infoAddress) {
        infoAddress.textContent = resolved;
      }
    });

    infoModal.hidden = false;

    if (!apiClient || !deviceKey) {
      return;
    }

    const deviceId = Number(device.deviceId);
    if (!Number.isFinite(deviceId) || deviceId <= 0) {
      return;
    }

    if (infoFuel && !cachedFuelReport) {
      infoFuel.textContent = 'Cargando...';
    }

    const range = buildCurrentDayFuelRange(device.fixTime || device.deviceTime || device.serverTime);

    try {
      const fuelReport = await apiClient.getFuelConsumptionReport(deviceId, range.from, range.to);
      if (!selectedDevice || String(selectedDevice.deviceId || '') !== deviceKey || !fuelReport) {
        return;
      }

      fuelReportByDeviceId.set(deviceKey, fuelReport);
      selectedDevice.fuelReportToday = fuelReport;

      if (infoFuel) {
        infoFuel.textContent = formatFuelReportValue(fuelReport);
      }
      if (infoDistance && fuelReport.detail?.distanceKm != null) {
        infoDistance.textContent = formatDistanceKm(fuelReport.detail.distanceKm);
      }
    } catch {
      if (selectedDevice && String(selectedDevice.deviceId || '') === deviceKey && infoFuel) {
        infoFuel.textContent = formatFuelValue(device);
      }
    }
  }

  function closeInfoModal() {
    if (!infoModal) {
      return;
    }
    infoModal.hidden = true;
  }

  function openCommandModal() {
    if (!commandModal) {
      return;
    }

    setCommandMessage('');

    if (!selectedDevice) {
      if (commandDeviceName) {
        commandDeviceName.value = '';
      }
      setCommandMessage('Primero seleccione una unidad en el mapa.', 'error');
    } else {
      if (commandDeviceName) {
        commandDeviceName.value = selectedDevice.vehicleName || selectedDevice.name || `ID ${selectedDevice.deviceId || '-'}`;
      }
    }

    if (commandAuthCode) {
      commandAuthCode.value = '';
    }
    if (commandSendButton) {
      commandSendButton.disabled = false;
    }
    if (commandCancelButton) {
      commandCancelButton.disabled = false;
    }
    commandSending = false;

    commandModal.hidden = false;
  }

  function closeCommandModal() {
    if (!commandModal) {
      return;
    }
    commandModal.hidden = true;
  }

  function setCommandMessage(text, tone = 'muted') {
    if (!commandMessage) {
      return;
    }

    commandMessage.hidden = !text;
    commandMessage.textContent = text || '';

    if (tone === 'error') {
      commandMessage.style.color = '#dc2626';
      return;
    }

    if (tone === 'success') {
      commandMessage.style.color = '#15803d';
      return;
    }

    commandMessage.style.color = '';
  }

  function resolveCommandLabel(commandValue) {
    return String(commandValue || '').trim() === 'engine_unlock'
      ? 'Desbloquear motor'
      : 'Apagar motor';
  }

  function selectDeviceFromMap(device, options = {}) {
    if (!device) {
      return;
    }

    selectedEvent = null;
    apiClient?.clearSelectedEvent?.();
    if (eventPanel) {
      eventPanel.hidden = true;
    }
    document.body.classList.remove('dashboard-body--event-focus');
    applyEventFocusState();

    try {
      apiClient?.storeSelectedDevice?.(device);
    } catch (_error) {
      // no-op: if persistence fails we still open the unit panel
    }

    showDevicePanel(device);
    if (devicePanel) {
      devicePanel.hidden = false;
    }

    const shouldCenter = Boolean(options.center);
    if (shouldCenter && liveMap) {
      const lat = Number(device.lat);
      const lon = Number(device.lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        liveMap.setView([lat, lon], Math.max(16, liveMap.getZoom() || 16));
      }
    }
  }

  function buildDeviceIcon(device, rotationDeg = 0) {
    const markerUrl = getMarkerUrl(device);
    const fallbackUrl = `../assets/markers/flecha_${getStatusColor(device)}.png`;
    const safeRotation = Number.isFinite(Number(rotationDeg)) ? Number(rotationDeg) : 0;

    return window.L.divIcon({
      className: 'gps-marker-real',
      html: `
        <div class="gps-marker-real__shell">
          <img class="gps-marker-real__img" style="transform: rotate(${safeRotation}deg); transition: transform 380ms linear;" src="${markerUrl}" alt="vehiculo" onerror="this.onerror=null;this.src='${fallbackUrl}'" />
        </div>
      `,
      iconSize: [42, 42],
      iconAnchor: [21, 21],
      popupAnchor: [0, -18]
    });
  }

  function buildClusterIcon(count, tone, variant) {
    return window.L.divIcon({
      className: 'gps-cluster-marker',
      html: `
        <button class="gps-cluster-marker__bubble gps-cluster-marker__bubble--${tone} gps-cluster-marker__bubble--${variant}" type="button">
          <strong>${count}</strong>
        </button>
      `,
      iconSize: variant === 'large' ? [54, 54] : [44, 44],
      iconAnchor: variant === 'large' ? [27, 27] : [22, 22]
    });
  }

  function buildEventIcon(eventItem) {
    return window.L.divIcon({
      className: 'gps-event-marker',
      html: '<div class="gps-event-marker__pin"></div>',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -26]
    });
  }

  function updateCounters(devices, alertSummary) {
    const moving = devices.filter((item) => Number(item?.speedKmh || 0) > 3).length;
    const withLocation = devices.filter((item) => Number.isFinite(Number(item?.lat)) && Number.isFinite(Number(item?.lon))).length;

    if (movingCount) {
      movingCount.textContent = String(moving);
    }
    if (locationCount) {
      locationCount.textContent = String(withLocation);
    }
    if (alertCount) {
      alertCount.textContent = String(alertSummary?.active ?? 0);
    }
  }

  function deriveCompanies(devices) {
    const grouped = new Map();
    devices.forEach((device) => {
      const company = device.groupName || 'Sin empresa';
      if (!grouped.has(company)) {
        grouped.set(company, []);
      }
      grouped.get(company).push(device);
    });

    currentCompanies = [...grouped.entries()]
      .map(([name, list]) => ({
        name,
        total: list.length,
        devices: list.sort((a, b) => String(a.vehicleName || a.name || '').localeCompare(String(b.vehicleName || b.name || '')))
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function getSearchQuery() {
    return String(searchInput?.value || '').trim().toLowerCase();
  }

  function filterDevices() {
    const query = getSearchQuery();

    return currentDevices.filter((device) => {
      const matchesCompany = !activeCompany || (device.groupName || 'Sin empresa') === activeCompany;
      const matchesStatus = activeStatusFilter === 'all' || getStatusKey(device) === activeStatusFilter;
      if (!matchesCompany || !matchesStatus) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        device.vehicleName,
        device.name,
        device.groupName,
        device.uniqueId
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(query);
    });
  }

  function buildDeviceCard(device, compact = false) {
    const status = getStatusTone(device);
    const markerUrl = getMarkerUrl(device);
    const fallbackUrl = `../assets/markers/flecha_${getStatusColor(device)}.png`;

    return `
      <button class="mobile-vehicle-card mobile-vehicle-card--${status.accent}${compact ? ' mobile-vehicle-card--compact' : ''}" type="button" data-device-id="${device.deviceId ?? ''}" data-device-lat="${device.lat ?? ''}" data-device-lon="${device.lon ?? ''}">
        <div class="mobile-vehicle-card__main">
          <div class="mobile-vehicle-card__icon-wrap">
            <img class="mobile-vehicle-card__icon" src="${markerUrl}" alt="icono vehiculo" onerror="this.onerror=null;this.src='${fallbackUrl}'" />
          </div>
          <div>
            <strong>${escapeHtml(device.vehicleName || device.name || 'Unidad')}</strong>
            <span>${escapeHtml(device.groupName || 'Sin empresa')}</span>
          </div>
        </div>
        <div class="mobile-vehicle-card__speed">${formatSpeed(device.speedKmh)}</div>
        <div class="mobile-vehicle-card__arrow-wrap">
          <img class="mobile-vehicle-card__arrow" src="../assets/markers/flecha_${getStatusColor(device)}.png" alt="estado" onerror="this.style.display='none'" />
        </div>
      </button>
    `;
  }

  function bindDeviceCardClicks(root) {
    root.querySelectorAll('[data-device-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const lat = Number(button.getAttribute('data-device-lat'));
        const lon = Number(button.getAttribute('data-device-lon'));
        if (Number.isFinite(lat) && Number.isFinite(lon) && liveMap) {
          const deviceId = String(button.getAttribute('data-device-id') || '');
          const selected = currentDevices.find((item) => String(item.deviceId) === deviceId) ||
            currentDevices.find((item) => Number(item.lat) === lat && Number(item.lon) === lon);
          if (selected) {
            apiClient?.storeSelectedDevice?.(selected);
            showDevicePanel(selected);
          }
          liveMap.setView([lat, lon], 16);
          setSheetOpen(false);
        }
      });
    });
  }

  function renderDeviceList(devices) {
    if (!deviceList) {
      return;
    }

    if (!devices.length) {
      deviceList.innerHTML = '<div class="mobile-map-empty">No hay vehiculos para el filtro actual.</div>';
      return;
    }

    deviceList.innerHTML = devices.map((device) => buildDeviceCard(device)).join('');
    bindDeviceCardClicks(deviceList);
  }

  function renderCompanyList() {
    if (!companyList) {
      return;
    }

    const query = getSearchQuery();
    const companies = currentCompanies.filter((company) => {
      if (!query) {
        return true;
      }

      const haystack = [company.name, ...company.devices.map((item) => item.vehicleName || item.name || '')]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });

    if (!companies.length) {
      companyList.innerHTML = '<div class="mobile-map-empty">No hay empresas visibles.</div>';
      return;
    }

    companyList.innerHTML = companies.map((company) => {
      const expanded = activeCompany === company.name;
      const companyKey = encodeURIComponent(company.name);
      return `
        <div class="mobile-company-group${expanded ? ' mobile-company-group--open' : ''}">
          <button class="mobile-company-card${expanded ? ' mobile-company-card--active' : ''}" type="button" data-company-key="${companyKey}">
            <span>${escapeHtml(company.name)}</span>
            <div class="mobile-company-card__meta">
              <strong>${company.total}</strong>
              <span class="mobile-company-card__chevron">${expanded ? '&#9662;' : '&#8250;'}</span>
            </div>
          </button>
          <div class="mobile-company-group__devices${expanded ? ' mobile-company-group__devices--open' : ''}">
            ${expanded ? company.devices.map((device) => buildDeviceCard(device, true)).join('') : ''}
          </div>
        </div>
      `;
    }).join('');

    companyList.querySelectorAll('[data-company-key]').forEach((button) => {
      button.addEventListener('click', () => {
        const companyName = decodeURIComponent(button.getAttribute('data-company-key') || '');
        activeCompany = companyName === activeCompany ? '' : companyName;
        renderCompanyList();
        renderDeviceList(filterDevices());
      });
    });

    bindDeviceCardClicks(companyList);
  }

  function buildClusters(devices, cellSize) {
    if (!liveMap) {
      return [];
    }

    const zoom = liveMap.getZoom();
    const grouped = new Map();

    devices.forEach((device) => {
      const lat = Number(device.lat);
      const lon = Number(device.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return;
      }

      const point = liveMap.project([lat, lon], zoom);
      const key = `${Math.floor(point.x / cellSize)}:${Math.floor(point.y / cellSize)}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(device);
    });

    return [...grouped.values()].map((items) => {
      const center = items.reduce((acc, item) => {
        acc.lat += Number(item.lat);
        acc.lon += Number(item.lon);
        return acc;
      }, { lat: 0, lon: 0 });

      return {
        count: items.length,
        items,
        lat: center.lat / items.length,
        lon: center.lon / items.length
      };
    });
  }

  function pickClusterTone(items) {
    if (items.some((item) => Number(item.speedKmh || 0) > 3)) {
      return 'green';
    }
    if (items.some((item) => Number(item.speedKmh || 0) > 0)) {
      return 'orange';
    }
    return 'gray';
  }

  function addDeviceMarker(device) {
    const lat = Number(device.lat);
    const lon = Number(device.lon);

    const marker = window.L.marker([lat, lon], {
      icon: buildDeviceIcon(device, Number(device?.course || 0))
    }).addTo(liveMap);

    marker.bindTooltip(escapeHtml(device.vehicleName || device.name || 'Unidad'), {
      permanent: true,
      direction: 'top',
      offset: [0, -18],
      className: 'gps-name-label'
    });

    const onSelectMarker = () => {
      selectDeviceFromMap(device, { center: true });
    };
    marker.on('click', onSelectMarker);
    marker.on('touchstart', onSelectMarker);

    renderMarkers.push(marker);
  }

  function getDeviceMarkerId(device) {
    return String(
      device?.deviceId ||
      device?.uniqueId ||
      device?.vehicleName ||
      `${Number(device?.lat || 0).toFixed(5)}:${Number(device?.lon || 0).toFixed(5)}`
    );
  }

  function computeBearing(fromLat, fromLon, toLat, toLon) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const toDeg = (rad) => (rad * 180) / Math.PI;

    const phi1 = toRad(fromLat);
    const phi2 = toRad(toLat);
    const lambda1 = toRad(fromLon);
    const lambda2 = toRad(toLon);
    const y = Math.sin(lambda2 - lambda1) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda2 - lambda1);
    const theta = toDeg(Math.atan2(y, x));
    return (theta + 360) % 360;
  }

  function resolveDeviceRotation(device, previousSnapshot) {
    const direct = Number(device?.course ?? device?.heading ?? device?.direction);
    if (Number.isFinite(direct) && Math.abs(direct) > 0) {
      return direct;
    }

    if (previousSnapshot) {
      const prevLat = Number(previousSnapshot.lat);
      const prevLon = Number(previousSnapshot.lon);
      const lat = Number(device.lat);
      const lon = Number(device.lon);
      if (
        Number.isFinite(prevLat) &&
        Number.isFinite(prevLon) &&
        Number.isFinite(lat) &&
        Number.isFinite(lon) &&
        (Math.abs(prevLat - lat) > 1e-7 || Math.abs(prevLon - lon) > 1e-7)
      ) {
        return computeBearing(prevLat, prevLon, lat, lon);
      }
      return Number(previousSnapshot.rotation || 0);
    }

    return 0;
  }

  function bindDevicePopup(marker, device) {
    marker.bindPopup(`
      <div class="gps-popup">
        <strong>${escapeHtml(device.vehicleName || device.name || 'Unidad')}</strong>
        <span>Direccion: ${escapeHtml(getAddressLabel(device.address, device))}</span>
        <span>Velocidad: ${formatSpeed(device.speedKmh)}</span>
      </div>
    `);

    resolveAddressNowIfNeeded(device).then((resolved) => {
      if (resolved) {
        marker.setPopupContent(`
          <div class="gps-popup">
            <strong>${escapeHtml(device.vehicleName || device.name || 'Unidad')}</strong>
            <span>Direccion: ${escapeHtml(resolved)}</span>
            <span>Velocidad: ${formatSpeed(device.speedKmh)}</span>
          </div>
        `);
      }
    });
  }

  function updateTrailForDevice(markerId, marker, device) {
    if (!trailLayerGroup) {
      return;
    }

    const markerPosition = marker?.getLatLng?.();
    const lat = Number(markerPosition?.lat ?? device?.lat);
    const lon = Number(markerPosition?.lng ?? device?.lon);
    const speed = Number(device?.speedKmh || 0);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return;
    }

    const history = movementHistoryById.get(markerId) || [];
    const last = history[history.length - 1];
    const shouldAppend = !last || distanceMeters(last[0], last[1], lat, lon) >= 2;

    if (shouldAppend) {
      history.push([lat, lon]);
      if (history.length > 18) {
        history.shift();
      }
      movementHistoryById.set(markerId, history);
    }

    const existing = trailPolylineById.get(markerId);
    if (speed <= 3 || history.length < 2) {
      if (existing) {
        existing.remove();
        trailPolylineById.delete(markerId);
      }
      return;
    }

    const tone = getStatusColor(device);
    const color = tone === 'verde' ? '#31c45f' : '#f0de39';
    if (existing) {
      existing.setLatLngs(history);
      existing.setStyle({ color });
      return;
    }

    const polyline = window.L.polyline(history, {
      color,
      weight: 4,
      opacity: 0.74,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(trailLayerGroup);

    trailPolylineById.set(markerId, polyline);
  }

  function animateMarkerTo(marker, toLat, toLon, durationMs = 1800) {
    const from = marker.getLatLng();
    const startLat = Number(from.lat);
    const startLon = Number(from.lng);
    const targetLat = Number(toLat);
    const targetLon = Number(toLon);

    if (!Number.isFinite(startLat) || !Number.isFinite(startLon) || !Number.isFinite(targetLat) || !Number.isFinite(targetLon)) {
      marker.setLatLng([toLat, toLon]);
      return;
    }

    if (typeof marker.__animCancel === 'function') {
      marker.__animCancel();
      marker.__animCancel = null;
    }

    const startTime = performance.now();
    let cancelled = false;
    marker.__animCancel = () => {
      cancelled = true;
    };

    function tick(now) {
      if (cancelled) {
        return;
      }
      const t = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - t, 2);
      marker.setLatLng([
        startLat + ((targetLat - startLat) * eased),
        startLon + ((targetLon - startLon) * eased)
      ]);

      if (t < 1) {
        window.requestAnimationFrame(tick);
      } else {
        marker.__animCancel = null;
      }
    }

    window.requestAnimationFrame(tick);
  }

  function renderDetailedMarkers(devices) {
    const activeIds = new Set();

    devices.forEach((device) => {
      const lat = Number(device.lat);
      const lon = Number(device.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return;
      }

      const markerId = getDeviceMarkerId(device);
      activeIds.add(markerId);

      const previousSnapshot = detailedSnapshots.get(markerId) || null;
      const rotation = resolveDeviceRotation(device, previousSnapshot);
      const speed = Number(device?.speedKmh || 0);
      const marker = detailedMarkers.get(markerId);

      if (!marker) {
        const created = window.L.marker([lat, lon], {
          icon: buildDeviceIcon(device, rotation)
        }).addTo(liveMap);

        created.bindTooltip(escapeHtml(device.vehicleName || device.name || 'Unidad'), {
          permanent: true,
          direction: 'top',
          offset: [0, -18],
          className: 'gps-name-label'
        });
        const onSelectMarker = () => {
          selectDeviceFromMap(device, { center: true });
        };
        created.on('click', onSelectMarker);
        created.on('touchstart', onSelectMarker);
        detailedMarkers.set(markerId, created);
      } else {
        marker.setIcon(buildDeviceIcon(device, rotation));
        marker.unbindPopup();
        marker.setLatLng([lat, lon]);
      }

      detailedSnapshots.set(markerId, {
        lat,
        lon,
        rotation
      });

      const markerRef = detailedMarkers.get(markerId);
      if (markerRef) {
        updateTrailForDevice(markerId, markerRef, device);
      }
    });

    [...detailedMarkers.keys()].forEach((markerId) => {
      if (!activeIds.has(markerId)) {
        const marker = detailedMarkers.get(markerId);
        if (marker) {
          marker.remove();
        }
        detailedMarkers.delete(markerId);
        detailedSnapshots.delete(markerId);
        movementHistoryById.delete(markerId);
        const trail = trailPolylineById.get(markerId);
        if (trail) {
          trail.remove();
          trailPolylineById.delete(markerId);
        }
      }
    });

  }

  function addClusterMarker(cluster, variant) {
    const tone = pickClusterTone(cluster.items);
    const marker = window.L.marker([cluster.lat, cluster.lon], {
      icon: buildClusterIcon(cluster.count, tone, variant)
    }).addTo(liveMap);

    marker.on('click', () => {
      if (variant === 'large') {
        liveMap.setView([cluster.lat, cluster.lon], Math.min(liveMap.getZoom() + 2, 13));
      } else {
        const bounds = window.L.latLngBounds(cluster.items.map((item) => [Number(item.lat), Number(item.lon)]));
        liveMap.fitBounds(bounds.pad(0.35));
      }
    });

    renderMarkers.push(marker);
  }

  function renderFocusedEventMarker() {
    clearEventFocusMarker();
    if (!selectedEvent || !liveMap) {
      return;
    }

    const lat = Number(selectedEvent.latitude);
    const lon = Number(selectedEvent.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return;
    }

    eventFocusMarker = window.L.marker([lat, lon], {
      icon: buildEventIcon(selectedEvent)
    }).addTo(liveMap);

    eventFocusMarker.bindPopup(`
      <div class="gps-popup">
        <strong>${escapeHtml(selectedEvent.vehicleName || 'Unidad')}</strong>
        <span>${escapeHtml(getFriendlyEventLabel(selectedEvent.eventType))}</span>
        <span>${escapeHtml(formatDateTime(selectedEvent.eventTime))}</span>
      </div>
    `).openPopup();
  }

  function renderMap(devices) {
    const map = ensureMap();
    if (!map) {
      return;
    }

    const withLocation = devices.filter((item) => Number.isFinite(Number(item?.lat)) && Number.isFinite(Number(item?.lon)));

    if (!withLocation.length) {
      clearMapMarkers();
      clearDetailedMarkers();
      clearTrails(true);
      map.setView([-4.05, -78.92], 6);
      renderFocusedEventMarker();
      return;
    }

    const zoom = map.getZoom();
    const useDetailedMarkers = zoom >= 15;

    if (useDetailedMarkers) {
      clearMapMarkers();
      renderDetailedMarkers(withLocation);
      renderFocusedEventMarker();
      return;
    }

    clearDetailedMarkers();
    clearTrails(false);
    clearMapMarkers();

    if (zoom >= 11) {
      buildClusters(withLocation, 90).forEach((cluster) => {
        if (cluster.count <= 1) {
          addDeviceMarker(cluster.items[0]);
          return;
        }
        addClusterMarker(cluster, 'medium');
      });
    } else {
      buildClusters(withLocation, 160).forEach((cluster) => {
        addClusterMarker(cluster, 'large');
      });
    }

    renderFocusedEventMarker();
  }

  function fitAllDevicesOnMap() {
    const map = ensureMap();
    if (!map) {
      return;
    }

    const withLocation = (Array.isArray(currentDevices) ? currentDevices : [])
      .filter((item) => Number.isFinite(Number(item?.lat)) && Number.isFinite(Number(item?.lon)));

    if (!withLocation.length) {
      return;
    }

    if (withLocation.length === 1) {
      map.setView([Number(withLocation[0].lat), Number(withLocation[0].lon)], 16);
      return;
    }

    const bounds = window.L.latLngBounds(withLocation.map((item) => [Number(item.lat), Number(item.lon)]));
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.18));
    }
  }

  function openPanoramicView(lat, lon) {
    const safeLat = Number(lat);
    const safeLon = Number(lon);
    if (!Number.isFinite(safeLat) || !Number.isFinite(safeLon)) {
      return;
    }

    const url = `https://www.google.com/maps?q=&layer=c&cbll=${safeLat},${safeLon}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function openExternalMapLocation(lat, lon, label = '') {
    const safeLat = Number(lat);
    const safeLon = Number(lon);
    if (!Number.isFinite(safeLat) || !Number.isFinite(safeLon)) {
      return;
    }

    const safeLabel = encodeURIComponent(String(label || `${safeLat},${safeLon}`).trim());
    const coordinateText = `${safeLat},${safeLon}`;
    const geoUrl = `geo:${coordinateText}?q=${coordinateText}(${safeLabel})`;
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordinateText)}`;
    const isNativeCapacitor = Boolean(
      window.Capacitor?.isNativePlatform?.() ||
      window.CapacitorAndroid ||
      window.webkit?.messageHandlers?.bridge
    );

    if (isNativeCapacitor) {
      window.location.href = geoUrl;
      window.setTimeout(() => {
        window.open(googleMapsUrl, '_blank', 'noopener,noreferrer');
      }, 600);
      return;
    }

    window.open(googleMapsUrl, '_blank', 'noopener,noreferrer');
  }

  function openShareModal() {
    if (!shareModal) {
      return;
    }
    if (shareMessage) {
      shareMessage.textContent = '';
    }
    shareModal.hidden = false;
  }

  function closeShareModal() {
    if (!shareModal) {
      return;
    }
    shareModal.hidden = true;
    shareSending = false;
    if (shareAcceptButton) {
      shareAcceptButton.disabled = false;
      shareAcceptButton.textContent = 'Aceptar';
    }
  }

  function formatDateInputValue(date) {
    const parsed = date instanceof Date ? date : new Date(date);
    const safe = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    const pad = (value) => String(value).padStart(2, '0');
    return `${safe.getFullYear()}-${pad(safe.getMonth() + 1)}-${pad(safe.getDate())}`;
  }

  function formatTimeInputValue(date) {
    const parsed = date instanceof Date ? date : new Date(date);
    const safe = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    const pad = (value) => String(value).padStart(2, '0');
    return `${pad(safe.getHours())}:${pad(safe.getMinutes())}`;
  }

  function getSelectedHistoryRange() {
    const checked = document.querySelector('input[name="historyRange"]:checked');
    return String(checked?.value || 'today');
  }

  function syncHistoryCustomFields() {
    if (!historyCustomFields) {
      return;
    }
    historyCustomFields.hidden = getSelectedHistoryRange() !== 'custom';
  }

  function openHistoryModal() {
    if (!historyModal) {
      return;
    }

    const now = new Date();
    if (historyFromDate) {
      historyFromDate.value = formatDateInputValue(now);
    }
    if (historyToDate) {
      historyToDate.value = formatDateInputValue(now);
    }
    if (historyFromTime) {
      historyFromTime.value = '00:00';
    }
    if (historyToTime) {
      historyToTime.value = formatTimeInputValue(now);
    }
    if (historyMessage) {
      historyMessage.textContent = '';
    }
    const defaultRadio = document.querySelector('input[name="historyRange"][value="today"]');
    if (defaultRadio) {
      defaultRadio.checked = true;
    }
    syncHistoryCustomFields();
    historyModal.hidden = false;
  }

  function closeHistoryModal() {
    if (!historyModal) {
      return;
    }
    historyModal.hidden = true;
    historyOpening = false;
    if (historyAcceptButton) {
      historyAcceptButton.disabled = false;
      historyAcceptButton.textContent = 'Aceptar';
    }
  }

  function buildHistoryRangeSelection() {
    const now = new Date();
    const preset = getSelectedHistoryRange();
    let from = new Date(now);
    let to = new Date(now);

    if (preset === 'today') {
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
    } else if (preset === 'yesterday') {
      from.setDate(from.getDate() - 1);
      from.setHours(0, 0, 0, 0);
      to = new Date(from);
      to.setHours(23, 59, 59, 999);
    } else if (preset === 'week') {
      const day = from.getDay();
      const diff = day === 0 ? 6 : day - 1;
      from.setDate(from.getDate() - diff);
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
    } else {
      const fromValue = `${historyFromDate?.value || ''}T${historyFromTime?.value || '00:00'}`;
      const toValue = `${historyToDate?.value || ''}T${historyToTime?.value || '23:59'}`;
      from = new Date(fromValue);
      to = new Date(toValue);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        throw new Error('Debes ingresar fecha y hora inicial y final validas.');
      }
    }

    if (from.getTime() > to.getTime()) {
      throw new Error('La fecha inicial no puede ser mayor que la fecha final.');
    }

    return {
      from: from.toISOString(),
      to: to.toISOString()
    };
  }

  function openHistoryPlayback() {
    if (!selectedDevice?.deviceId) {
      return;
    }

    closeInfoModal();
    openHistoryModal();
  }

  function getSelectedShareDurationMinutes() {
    const checked = document.querySelector('input[name="shareDuration"]:checked');
    const numeric = Number(checked?.value || 10);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 10;
  }

  function sendShareToWhatsapp(shareUrl, deviceName, durationMinutes) {
    const safeUrl = String(shareUrl || '').trim();
    if (!safeUrl) {
      throw new Error('No se pudo generar el enlace compartido.');
    }

    const message = [
      `Monitoreo temporal de ${deviceName || 'la unidad'}`,
      `Disponible por ${durationMinutes} min`,
      safeUrl
    ].join('\n');

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

    if (navigator.share) {
      navigator.share({
        title: `Monitoreo de ${deviceName || 'unidad'}`,
        text: message,
        url: safeUrl
      }).catch(() => {
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      });
      return;
    }

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  }

  function openUserCurrentLocation() {
    const map = ensureMap();
    if (!map) {
      return;
    }

    const paintUserLocation = (coords) => {
      const lat = Number(coords?.latitude);
      const lon = Number(coords?.longitude);
      const accuracy = Number(coords?.accuracy || 0);

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return false;
      }

      if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
        userLocationMarker = null;
      }

      if (userAccuracyCircle) {
        map.removeLayer(userAccuracyCircle);
        userAccuracyCircle = null;
      }

      userLocationMarker = window.L.circleMarker([lat, lon], {
        radius: 7,
        color: '#ffffff',
        weight: 2,
        fillColor: '#2563eb',
        fillOpacity: 1
      }).addTo(map);

      if (accuracy > 0) {
        userAccuracyCircle = window.L.circle([lat, lon], {
          radius: accuracy,
          color: '#3b82f6',
          weight: 1,
          fillColor: '#60a5fa',
          fillOpacity: 0.14
        }).addTo(map);
      }

      userLocationMarker.bindPopup('Tu ubicacion actual').openPopup();
      map.setView([lat, lon], Math.max(16, map.getZoom() || 16), { animate: true });
      return true;
    };

    const getCurrentPositionWeb = () => new Promise((resolve, reject) => {
      if (!window.navigator?.geolocation) {
        reject(new Error('GEOLOCATION_UNSUPPORTED'));
        return;
      }

      window.navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 10000
      });
    });

    userLocationButton?.classList.add('mobile-map-action--active');

    (async () => {
      try {
        const capGeo = window.Capacitor?.Plugins?.Geolocation;
        if (capGeo?.getCurrentPosition) {
          try {
            await capGeo.requestPermissions?.();
          } catch {
            // continuar con el intento de lectura
          }

          const pos = await capGeo.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 12000
          });

          if (paintUserLocation(pos?.coords || pos)) {
            return;
          }
        }

        const posWeb = await getCurrentPositionWeb();
        if (paintUserLocation(posWeb?.coords || posWeb)) {
          return;
        }

        throw new Error('GEOLOCATION_INVALID_COORDS');
      } catch {
        window.alert('No se pudo obtener tu ubicacion. Verifica permisos de ubicacion del dispositivo.');
      } finally {
        userLocationButton?.classList.remove('mobile-map-action--active');
      }
    })();
  }

  function applyEventFocusState() {
    const hasEvent = Boolean(selectedEvent);
    const wasHidden = Boolean(eventPanel?.hidden);

    document.body.classList.toggle('dashboard-body--event-focus', hasEvent);
    if (backButton) {
      backButton.hidden = !hasEvent;
    }

    if (headerTitle) {
      headerTitle.textContent = hasEvent
        ? (selectedEvent.vehicleName || 'Evento')
        : 'Mapa';
    }

    if (eventPanel) {
      eventPanel.hidden = !hasEvent;
    }

    if (!hasEvent) {
      if (eventAddressText) {
        eventAddressText.hidden = true;
      }
      return;
    }

    if (wasHidden) {
      initializePanelHeight(eventPanel, 220);
    }

    if (eventType) {
      eventType.textContent = getFriendlyEventLabel(selectedEvent.eventType);
    }
    if (eventSpeed) {
      eventSpeed.textContent = formatSpeed(selectedEvent.speed);
    }
    if (eventTime) {
      eventTime.textContent = formatDateTime(selectedEvent.eventTime);
    }
    if (eventAddressText) {
      eventAddressText.textContent = getAddressLabel(selectedEvent.address, selectedEvent);
      eventAddressText.hidden = true;
    }
  }

  function resolveSelectedEvent() {
    const currentUrl = new URL(window.location.href);
    const eventId = currentUrl.searchParams.get('eventId');
    const from = currentUrl.searchParams.get('from');

    if (!eventId || from !== 'events') {
      apiClient?.clearSelectedEvent?.();
      return null;
    }

    const fromStorage = apiClient?.getSelectedEvent?.();

    if (fromStorage && String(fromStorage.eventId) === String(eventId)) {
      return fromStorage;
    }

    return null;
  }

  function resolveSelectedDevice() {
    const currentUrl = new URL(window.location.href);
    const deviceId = currentUrl.searchParams.get('deviceId');
    pendingDeviceAction = String(currentUrl.searchParams.get('action') || '').trim().toLowerCase();
    const fromStorage = apiClient?.getSelectedDevice?.();

    if (deviceId && fromStorage && String(fromStorage.deviceId) === String(deviceId)) {
      return fromStorage;
    }

    if (deviceId) {
      return { deviceId };
    }

    // Sin deviceId en URL siempre iniciamos sin seleccion.
    apiClient?.clearSelectedDevice?.();
    return null;
  }

  function focusSelectedEvent() {
    if (!selectedEvent || !liveMap) {
      return;
    }

    const lat = Number(selectedEvent.latitude);
    const lon = Number(selectedEvent.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return;
    }

    liveMap.setView([lat, lon], 16);
  }

  function consumePendingDeviceAction() {
    const action = pendingDeviceAction;
    pendingDeviceAction = '';

    if (!action || !selectedDevice?.deviceId) {
      return;
    }

    if (action === 'info') {
      openInfoModal();
      return;
    }

    if (action === 'command') {
      openCommandModal();
      return;
    }

    if (action === 'geofences') {
      geofencesVisible = true;
      syncGeofencesControls();
      renderGeofences();
    }
  }

  async function loadMapPage(options = {}) {
    const preserveViewport = Boolean(options.preserveViewport);
    if (!apiClient) {
      return;
    }

    updateMapLoadingOverlay(true);

    try {
      const session = await appShell?.requireSession?.({
        redirectOnMissing: true
      });
      if (!session) {
        updateMapLoadingOverlay(false);
        currentDevices = [];
        currentCompanies = [];
        currentAlertSummary = null;
        updateCounters([], { active: 0 });
        renderDeviceList([]);
        renderCompanyList();
        renderMap([]);
        applyEventFocusState();
        showDevicePanel(null);
        return;
      }

      const dashboard = await apiClient.getDashboard();
      currentDevices = Array.isArray(dashboard.devices) ? dashboard.devices : [];
      currentAlertSummary = dashboard.alertSummary || null;
      try {
        const geofencesPayload = await apiClient.getGeofences();
        currentGeofences = Array.isArray(geofencesPayload?.items) ? geofencesPayload.items : [];
      } catch {
        currentGeofences = [];
      }
      deriveCompanies(currentDevices);
      updateCounters(currentDevices, currentAlertSummary);
      const filteredDevices = filterDevices();
      renderDeviceList(filteredDevices);
      renderCompanyList();
      renderMap(filteredDevices);
      renderGeofences();
      applyEventFocusState();
      updateMapLoadingOverlay(false);

      if (selectedEvent) {
        showDevicePanel(null);
        focusSelectedEvent();
      } else if (selectedDevice?.deviceId) {
        const device = currentDevices.find((item) => String(item.deviceId) === String(selectedDevice.deviceId));
        if (device) {
          apiClient?.storeSelectedDevice?.(device);
          showDevicePanel(device);
          if (liveMap && Number.isFinite(Number(device.lat)) && Number.isFinite(Number(device.lon))) {
            liveMap.setView([Number(device.lat), Number(device.lon)], 16);
          }
          consumePendingDeviceAction();
        }
      } else if (!preserveViewport && !hasInitializedViewport && currentDevices.length > 0 && liveMap) {
        showDevicePanel(null);
        const bounds = window.L.latLngBounds(currentDevices
          .filter((item) => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon)))
          .map((item) => [Number(item.lat), Number(item.lon)]));
        if (bounds.isValid()) {
          liveMap.fitBounds(bounds.pad(0.2));
          hasInitializedViewport = true;
        }
      }
    } catch (_error) {
      updateMapLoadingOverlay(false);
      currentDevices = [];
      currentCompanies = [];
      currentAlertSummary = null;
      currentGeofences = [];
      updateCounters([], { active: 0 });
      renderDeviceList([]);
      renderCompanyList();
      renderMap([]);
      renderGeofences();
      applyEventFocusState();
      showDevicePanel(null);
    }
  }

  selectedEvent = resolveSelectedEvent();
  selectedDevice = resolveSelectedDevice();
  syncSelectionActionButtons(Boolean(selectedDevice && selectedDevice.deviceId));

  menuButton?.addEventListener('click', () => {
    const isOpen = sheet?.classList.contains('mobile-map-sheet--open');
    setSheetOpen(!isOpen);
  });

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      switchTab(button.dataset.sheetTab || 'devices');
    });
  });

  searchInput?.addEventListener('input', () => {
    renderDeviceList(filterDevices());
    renderCompanyList();
  });

  clearSearchButton?.addEventListener('click', () => {
    if (searchInput) {
      searchInput.value = '';
    }
    renderDeviceList(filterDevices());
    renderCompanyList();
  });

  refreshButton?.addEventListener('click', () => {
    fitAllDevicesOnMap();
  });

  layerButton?.addEventListener('click', () => {
    setLayerPanelOpen(layerPanel?.hidden);
  });

  document.querySelectorAll('[data-map-layer]').forEach((button) => {
    button.addEventListener('click', () => {
      switchBaseLayer(button.dataset.mapLayer || 'osm');
    });
  });

  document.querySelectorAll('[data-map-status]').forEach((button) => {
    button.addEventListener('click', () => {
      activeStatusFilter = button.dataset.mapStatus || 'all';
      document.querySelectorAll('[data-map-status]').forEach((item) => {
        item.classList.toggle('mobile-map-layer-chip--active', item === button);
      });
      const filteredDevices = filterDevices();
      renderDeviceList(filteredDevices);
      renderCompanyList();
      renderMap(filteredDevices);
    });
  });

  geofencesToggle?.addEventListener('click', () => {
    geofencesVisible = !geofencesVisible;
    syncGeofencesControls();
    renderGeofences();
  });

  geofenceFabButton?.addEventListener('click', () => {
    geofencesVisible = !geofencesVisible;
    syncGeofencesControls();
    renderGeofences();
  });

  zoomInButton?.addEventListener('click', () => {
    ensureMap()?.zoomIn();
  });

  zoomOutButton?.addEventListener('click', () => {
    ensureMap()?.zoomOut();
  });

  locateButton?.addEventListener('click', () => {
    if (selectedDevice && Number.isFinite(Number(selectedDevice.lat)) && Number.isFinite(Number(selectedDevice.lon))) {
      openPanoramicView(selectedDevice.lat, selectedDevice.lon);
      return;
    }

    const withLocation = currentDevices.filter((item) => Number.isFinite(Number(item?.lat)) && Number.isFinite(Number(item?.lon)));
    if (!withLocation.length) {
      return;
    }

    openPanoramicView(withLocation[0].lat, withLocation[0].lon);
  });

  userLocationButton?.addEventListener('click', () => {
    openUserCurrentLocation();
  });

  alertsButton?.addEventListener('click', () => {
    setTrafficVisible(!trafficVisible);
  });

  routesButton?.addEventListener('click', () => {
    openHistoryPlayback();
  });

  backButton?.addEventListener('click', () => {
    const returnTo = String(pageUrl.searchParams.get('returnTo') || '').trim().toLowerCase();
    const from = String(pageUrl.searchParams.get('from') || '').trim().toLowerCase();

    if (returnTo === 'device-sheet' || from === 'devices') {
      apiClient?.clearSelectedEvent?.();
      window.location.href = buildReturnToDeviceSheetUrl(pageUrl.searchParams.get('deviceId'));
      return;
    }

    apiClient?.clearSelectedEvent?.();
    window.location.href = './alerts.html';
  });

  eventAddressButton?.addEventListener('click', () => {
    if (!eventAddressText) {
      return;
    }
    eventAddressText.hidden = !eventAddressText.hidden;
  });

  deviceAddressButton?.addEventListener('click', () => {
    if (!selectedDevice || !liveMap) {
      return;
    }
    const lat = Number(selectedDevice.lat);
    const lon = Number(selectedDevice.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return;
    }
    liveMap.setView([lat, lon], Math.max(16, liveMap.getZoom() || 16));
    if (deviceAddressText) {
      deviceAddressText.hidden = false;
    }
  });

  deviceInfoButton?.addEventListener('click', () => {
    openInfoModal();
  });

  deviceRouteButton?.addEventListener('click', () => {
    if (!selectedDevice) {
      return;
    }

    const lat = Number(selectedDevice.lat);
    const lon = Number(selectedDevice.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      window.alert('La unidad seleccionada no tiene coordenadas disponibles.');
      return;
    }

    openExternalMapLocation(lat, lon, selectedDevice.vehicleName || selectedDevice.name || 'Ubicacion');
  });

  deviceShareButton?.addEventListener('click', () => {
    if (!selectedDevice?.deviceId) {
      return;
    }

    openShareModal();
  });

  deviceHistoryButton?.addEventListener('click', () => {
    openHistoryPlayback();
  });

  shareModalBackdrop?.addEventListener('click', closeShareModal);
  shareCancelButton?.addEventListener('click', closeShareModal);
  shareAcceptButton?.addEventListener('click', async () => {
    if (shareSending || !selectedDevice?.deviceId || !apiClient) {
      return;
    }

    shareSending = true;
    if (shareAcceptButton) {
      shareAcceptButton.disabled = true;
      shareAcceptButton.textContent = 'Generando...';
    }
    if (shareMessage) {
      shareMessage.textContent = 'Creando enlace temporal...';
    }

    try {
      const durationMinutes = getSelectedShareDurationMinutes();
      const payload = await apiClient.createShareLink({
        deviceId: Number(selectedDevice.deviceId),
        deviceName: selectedDevice.vehicleName || selectedDevice.name || 'Unidad',
        durationMinutes
      });

      if (!payload?.shareUrl) {
        throw new Error('No se pudo obtener el enlace compartido.');
      }

      if (shareMessage) {
        shareMessage.textContent = 'Abriendo WhatsApp...';
      }

      sendShareToWhatsapp(
        payload.shareUrl,
        selectedDevice.vehicleName || selectedDevice.name || 'Unidad',
        durationMinutes
      );
      closeShareModal();
    } catch (error) {
      if (shareMessage) {
        shareMessage.textContent = error?.userMessage || error?.message || 'No se pudo crear el enlace compartido.';
      }
      shareSending = false;
      if (shareAcceptButton) {
        shareAcceptButton.disabled = false;
        shareAcceptButton.textContent = 'Aceptar';
      }
    }
  });

  historyModalBackdrop?.addEventListener('click', closeHistoryModal);
  historyCancelButton?.addEventListener('click', closeHistoryModal);
  document.querySelectorAll('input[name="historyRange"]').forEach((input) => {
    input.addEventListener('change', syncHistoryCustomFields);
  });
  historyAcceptButton?.addEventListener('click', () => {
    if (historyOpening || !selectedDevice?.deviceId || !apiClient) {
      return;
    }

    historyOpening = true;
    if (historyAcceptButton) {
      historyAcceptButton.disabled = true;
      historyAcceptButton.textContent = 'Abriendo...';
    }
    if (historyMessage) {
      historyMessage.textContent = '';
    }

    try {
      const range = buildHistoryRangeSelection();
      apiClient?.storeRouteContext?.({
        deviceId: String(selectedDevice.deviceId),
        from: range.from,
        to: range.to
      });
      closeHistoryModal();
      const params = new URLSearchParams({
        deviceId: String(selectedDevice.deviceId),
        from: 'map'
      });
      if (String(pageUrl.searchParams.get('returnTo') || '').trim().toLowerCase() === 'device-sheet') {
        params.set('returnTo', 'device-sheet');
      }
      window.location.href = `./routes.html?${params.toString()}`;
    } catch (error) {
      if (historyMessage) {
        historyMessage.textContent = error?.message || 'No se pudo preparar el historial.';
      }
      historyOpening = false;
      if (historyAcceptButton) {
        historyAcceptButton.disabled = false;
        historyAcceptButton.textContent = 'Aceptar';
      }
    }
  });

  deviceCommandButton?.addEventListener('click', () => {
    openCommandModal();
  });

  deviceHistoryButton?.addEventListener('click', () => {
    openCommandModal();
  });

  commandModalBackdrop?.addEventListener('click', closeCommandModal);
  commandModalClose?.addEventListener('click', closeCommandModal);
  commandCancelButton?.addEventListener('click', closeCommandModal);

  infoModalBackdrop?.addEventListener('click', closeInfoModal);
  infoModalClose?.addEventListener('click', closeInfoModal);
  infoAddressBtn?.addEventListener('click', () => {
    if (!infoAddress) {
      return;
    }
    infoAddress.hidden = !infoAddress.hidden;
  });

  infoFuelReportBtn?.addEventListener('click', () => {
    if (!selectedDevice) {
      return;
    }

    window.alert(formatFuelReportMessage(selectedDevice));
  });

  infoActionHistory?.addEventListener('click', () => {
    if (!selectedDevice?.deviceId) {
      return;
    }
    openHistoryPlayback();
  });

  infoActionCommand?.addEventListener('click', () => {
    closeInfoModal();
    openCommandModal();
  });

  infoActionReport?.addEventListener('click', () => {
    closeInfoModal();
    window.location.href = './alerts.html';
  });

  commandSendButton?.addEventListener('click', async () => {
    if (commandSending) {
      return;
    }

    if (!selectedDevice) {
      setCommandMessage('Seleccione una unidad antes de enviar comando.', 'error');
      return;
    }

    const deviceId = Number(selectedDevice.deviceId);
    if (!Number.isFinite(deviceId) || deviceId <= 0) {
      setCommandMessage('La unidad seleccionada no tiene un identificador valido.', 'error');
      return;
    }

    const authCode = String(commandAuthCode?.value || '').trim();
    if (!authCode) {
      setCommandMessage('Ingrese la clave de autorizacion.', 'error');
      return;
    }

    const commandValue = String(commandType?.value || 'engine_stop').trim();
    if (commandValue !== 'engine_stop' && commandValue !== 'engine_unlock') {
      setCommandMessage('Seleccione un comando valido.', 'error');
      return;
    }

    if (!apiClient?.sendCommand) {
      setCommandMessage('El API de comandos no esta disponible en esta version.', 'error');
      return;
    }

    const commandLabel = resolveCommandLabel(commandValue);
    const targetLabel = selectedDevice.vehicleName || selectedDevice.name || 'unidad';

    try {
      commandSending = true;
      if (commandSendButton) {
        commandSendButton.disabled = true;
      }
      if (commandCancelButton) {
        commandCancelButton.disabled = true;
      }

      setCommandMessage(`Enviando "${commandLabel}" para ${targetLabel}...`);

      const result = await apiClient.sendCommand({
        deviceId,
        command: commandValue,
        authorizationKey: authCode
      });

      if (commandAuthCode) {
        commandAuthCode.value = '';
      }

      setCommandMessage(result?.message || `Comando "${commandLabel}" enviado correctamente.`, 'success');
    } catch (error) {
      const code = String(error?.code || error?.payload?.code || '').toUpperCase();
      if (code === 'SESSION_EXPIRED' || code === 'SESSION_NOT_FOUND') {
        setCommandMessage('La sesion expiro. Vuelva a iniciar sesion para enviar comandos.', 'error');
        return;
      }

      const message =
        String(error?.payload?.message || '').trim() ||
        String(error?.message || '').trim() ||
        'No se pudo enviar el comando.';

      setCommandMessage(message, 'error');
    } finally {
      commandSending = false;
      if (commandSendButton) {
        commandSendButton.disabled = false;
      }
      if (commandCancelButton) {
        commandCancelButton.disabled = false;
      }
    }
  });

  sheet?.addEventListener('wheel', (event) => {
    event.stopPropagation();
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAutoRefresh();
      return;
    }
    startAutoRefresh();
  });

  switchTab('devices');
  initializePanelHeight(devicePanel, 116);
  initializePanelHeight(eventPanel, 220);
  setupDraggablePanel(devicePanel, devicePanelGrabber);
  setupDraggablePanel(eventPanel, eventPanelGrabber);
  syncGeofencesControls();
  setTrafficVisible(false);
  applyEventFocusState();
  loadMapPage();
  startAutoRefresh();
})();
