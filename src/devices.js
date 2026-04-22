(function () {
  const apiClient = window.GpsRastreoApi;
  const appShell = window.GpsRastreoShell;
  const searchInput = document.getElementById('devicesSearch');
  const companyList = document.getElementById('devicesCompanyList');
  const summary = document.getElementById('devicesSummary');
  const filterButtons = Array.from(document.querySelectorAll('[data-device-filter]'));
  const deviceActionsSheet = document.getElementById('deviceActionsSheet');
  const deviceActionsSheetBackdrop = document.getElementById('deviceActionsSheetBackdrop');
  const deviceActionsSheetClose = document.getElementById('deviceActionsSheetClose');
  const deviceActionsSheetTitle = document.getElementById('deviceActionsSheetTitle');
  const deviceReportsModal = document.getElementById('deviceReportsModal');
  const deviceReportsBackdrop = document.getElementById('deviceReportsBackdrop');
  const deviceReportsBack = document.getElementById('deviceReportsBack');
  const deviceReportRequestModal = document.getElementById('deviceReportRequestModal');
  const deviceReportRequestBackdrop = document.getElementById('deviceReportRequestBackdrop');
  const deviceReportRequestBack = document.getElementById('deviceReportRequestBack');
  const deviceReportRequestCancel = document.getElementById('deviceReportRequestCancel');
  const deviceReportRequestAccept = document.getElementById('deviceReportRequestAccept');
  const deviceReportRequestTitle = document.getElementById('deviceReportRequestTitle');
  const deviceReportRequestSubtitle = document.getElementById('deviceReportRequestSubtitle');
  const deviceReportRequestFromDate = document.getElementById('deviceReportRequestFromDate');
  const deviceReportRequestFromTime = document.getElementById('deviceReportRequestFromTime');
  const deviceReportRequestToDate = document.getElementById('deviceReportRequestToDate');
  const deviceReportRequestToTime = document.getElementById('deviceReportRequestToTime');
  const deviceEditModal = document.getElementById('deviceEditModal');
  const deviceEditBackdrop = document.getElementById('deviceEditBackdrop');
  const deviceEditCancel = document.getElementById('deviceEditCancel');
  const deviceEditAccept = document.getElementById('deviceEditAccept');
  const deviceEditNameInput = document.getElementById('deviceEditNameInput');
  const currentUrl = new URL(window.location.href);

  let currentDevices = [];
  let groupedCompanies = [];
  let currentFilter = 'all';
  let expandedCompany = '';
  let geocodeRefreshTimer = null;
  let geocodeRefreshAttempts = 0;
  const MAX_GEOCODE_REFRESH_ATTEMPTS = 6;
  let activeSheetDeviceId = '';
  let deviceRenameAbortController = null;
  let activeReportRequest = null;

  function createLoadingMarkup() {
    return `
      <div class="mobile-map-empty mobile-map-empty--loading">
        <div class="loading-indicator loading-indicator--light" aria-label="Procesando">
          <div class="loading-indicator__spinner" aria-hidden="true"></div>
        </div>
      </div>
    `;
  }

  const REPORT_CARD_CONFIG = {
    information: {
      cardLabel: 'Información',
      type: 'general',
      title: 'Reporte General',
      subtitle: 'Genera el resumen general del dispositivo con el formato corporativo.'
    },
    routes: {
      cardLabel: 'Recorridos',
      type: 'routeStops',
      title: 'Reporte Recorridos y paradas',
      subtitle: 'Genera el detalle de movimientos y paradas para el rango seleccionado.'
    },
    workhours: {
      cardLabel: 'Horas de trabajo',
      type: 'driveHours',
      title: 'Horas de trabajo',
      subtitle: 'Genera el reporte diario de horas de manejo del dispositivo.'
    }
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function formatSpeed(speed) {
    return `${Math.round(Number(speed || 0))} km/h`;
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
      return 'red';
    }
    if (text.includes('green') || text.includes('verde')) {
      return 'green';
    }
    if (text.includes('yellow') || text.includes('amarillo')) {
      return 'yellow';
    }
    if (text.includes('gray') || text.includes('grey') || text.includes('gris')) {
      return 'gray';
    }

    return '';
  }

  function resolveExplicitColor(device) {
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
        return signal ? 'green' : 'red';
      }

      const text = normalizeStatusText(signal);
      if (text === 'true' || text === '1' || text === 'on' || text === 'encendido') {
        return 'green';
      }
      if (text === 'false' || text === '0' || text === 'off' || text === 'apagado') {
        return 'red';
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

    for (const value of explicitColorFields) {
      const color = resolveColorFromText(value);
      if (color) {
        return color;
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
      device?.IconName
    ].map((value) => normalizeStatusText(value)).join(' | ');

    const byHintColor = resolveColorFromText(hints);
    if (byHintColor) {
      return byHintColor;
    }

    if (hints.includes('sin se') || hints.includes('offline')) {
      return 'gray';
    }
    if (
      hints.includes('detenido') ||
      hints.includes('stopped') ||
      hints.includes('ignitionoff') ||
      hints.includes('apagado') ||
      hints.includes('motor off') ||
      hints.includes('motor apagado')
    ) {
      return 'red';
    }
    if (
      hints.includes('movimiento') ||
      hints.includes('moving') ||
      hints.includes('ignitionon') ||
      hints.includes('encendido') ||
      hints.includes('motor on') ||
      hints.includes('motor encendido')
    ) {
      return 'green';
    }

    return '';
  }

  function getMarkerColor(device) {
    const explicitColor = resolveExplicitColor(device);
    if (explicitColor) {
      if (explicitColor === 'green') return 'verde';
      if (explicitColor === 'yellow') return 'amarillo';
      if (explicitColor === 'gray') return 'gris';
      return 'rojo';
    }

    const tone = getStatusTone(device).color;
    if (tone === 'green') return 'verde';
    if (tone === 'yellow') return 'amarillo';
    if (tone === 'gray') return 'gris';
    return 'rojo';
  }

  function getStatusTone(device) {
    const explicitColor = resolveExplicitColor(device);
    if (explicitColor === 'gray') {
      return { key: 'offline', label: 'Sin señal', color: 'gray' };
    }
    if (explicitColor === 'red') {
      return { key: 'stopped', label: 'Detenido', color: 'red' };
    }
    if (explicitColor === 'green') {
      return { key: 'moving', label: 'Movimiento', color: 'green' };
    }
    if (explicitColor === 'yellow') {
      return { key: 'idle', label: 'Reposo', color: 'yellow' };
    }

    const statusHint = [
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
      device?.IconName
    ].map((value) => String(value || '').toLowerCase()).join(' | ');

    if (statusHint.includes('sin se') || statusHint.includes('offline')) {
      return { key: 'offline', label: 'Sin señal', color: 'gray' };
    }
    if (
      statusHint.includes('detenido') ||
      statusHint.includes('stopped') ||
      statusHint.includes('ignitionoff') ||
      statusHint.includes('apagado') ||
      statusHint.includes('rojo') ||
      statusHint.includes('_red') ||
      statusHint.includes('_rojo')
    ) {
      return { key: 'stopped', label: 'Detenido', color: 'red' };
    }
    if (
      statusHint.includes('movimiento') ||
      statusHint.includes('moving') ||
      statusHint.includes('ignitionon') ||
      statusHint.includes('encendido') ||
      statusHint.includes('verde') ||
      statusHint.includes('_green') ||
      statusHint.includes('_verde')
    ) {
      return { key: 'moving', label: 'Movimiento', color: 'green' };
    }

    const speed = Number(device?.speedKmh || 0);
    const hasLocation = Number.isFinite(Number(device?.lat)) && Number.isFinite(Number(device?.lon));
    const fixTime = device?.fixTime ? new Date(device.fixTime) : null;
    const ageHours = fixTime && !Number.isNaN(fixTime.getTime())
      ? Math.abs(Date.now() - fixTime.getTime()) / 36e5
      : Number.POSITIVE_INFINITY;

    if (!hasLocation || ageHours > 24) {
      return { key: 'offline', label: 'Sin señal', color: 'gray' };
    }
    if (speed > 3) {
      return { key: 'moving', label: 'Movimiento', color: 'green' };
    }
    if (speed > 0) {
      return { key: 'idle', label: 'Reposo', color: 'yellow' };
    }
    return { key: 'stopped', label: 'Detenido', color: 'red' };
  }

  function getMarkerBase(device) {
    return String(device?.iconBase || 'flecha').trim() || 'flecha';
  }

  function getMarkerUrl(device, suffix) {
    return `../assets/markers/${getMarkerBase(device)}_${suffix}.png`;
  }

  function getAddressLabel(device) {
    const candidates = [
      device?.address,
      device?.Address,
      device?.direccion,
      device?.Direccion,
      device?.locationAddress,
      device?.LocationAddress,
      device?.formattedAddress,
      device?.FormattedAddress
    ];
    const found = candidates.find((value) => String(value || '').trim().length > 0);
    if (found) {
      return String(found).trim();
    }

    const lat = Number(device?.lat ?? device?.latitude ?? device?.Lat ?? device?.Latitude);
    const lon = Number(device?.lon ?? device?.longitude ?? device?.Lon ?? device?.Longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    }

    return 'Obteniendo dirección...';
  }

  function hasAddressText(device) {
    const candidates = [
      device?.address,
      device?.Address,
      device?.direccion,
      device?.Direccion,
      device?.locationAddress,
      device?.LocationAddress,
      device?.formattedAddress,
      device?.FormattedAddress
    ];

    return candidates.some((value) => String(value || '').trim().length > 0);
  }

  function scheduleGeocodeRefreshIfNeeded(devices) {
    if (geocodeRefreshTimer) {
      window.clearTimeout(geocodeRefreshTimer);
      geocodeRefreshTimer = null;
    }

    if (geocodeRefreshAttempts >= MAX_GEOCODE_REFRESH_ATTEMPTS) {
      return;
    }

    const unresolved = devices.some((device) => {
      const lat = Number(device?.lat ?? device?.latitude ?? device?.Lat ?? device?.Latitude);
      const lon = Number(device?.lon ?? device?.longitude ?? device?.Lon ?? device?.Longitude);
      return Number.isFinite(lat) && Number.isFinite(lon) && !hasAddressText(device);
    });

    if (!unresolved) {
      geocodeRefreshAttempts = 0;
      return;
    }

    geocodeRefreshAttempts += 1;
    geocodeRefreshTimer = window.setTimeout(() => {
      loadDevices();
    }, 5500);
  }

  function getDeviceSearchText(device) {
    return [
      device.vehicleName,
      device.name,
      device.groupName,
      device.uniqueId
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function filterByMode(device) {
    const status = getStatusTone(device).key;
    if (currentFilter === 'all') return true;
    return status === currentFilter;
  }

  function buildGroups(devices) {
    const groups = new Map();
    devices.forEach((device) => {
      const companyName = device.groupName || 'Sin empresa';
      if (!groups.has(companyName)) {
        groups.set(companyName, []);
      }
      groups.get(companyName).push(device);
    });

    groupedCompanies = [...groups.entries()]
      .map(([name, items]) => ({
        name,
        items: items.sort((a, b) => String(a.vehicleName || a.name || '').localeCompare(String(b.vehicleName || b.name || '')))
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function renderSummary(devices) {
    if (!summary) {
      return;
    }

    const moving = devices.filter((item) => getStatusTone(item).key === 'moving').length;
    const idle = devices.filter((item) => getStatusTone(item).key === 'idle').length;
    const stopped = devices.filter((item) => getStatusTone(item).key === 'stopped').length;
    const offline = devices.filter((item) => getStatusTone(item).key === 'offline').length;

    summary.innerHTML = `
      <article class="mobile-devices-kpi">
        <strong>Total: ${devices.length}</strong>
      </article>
      <article class="mobile-devices-kpi">
        <strong>Movimiento: ${moving}</strong>
      </article>
      <article class="mobile-devices-kpi">
        <strong>Reposo: ${idle}</strong>
      </article>
      <article class="mobile-devices-kpi">
        <strong>Detenido / sin señal: ${stopped + offline}</strong>
      </article>
    `;
  }

  function getFilteredCompanies() {
    const query = String(searchInput?.value || '').trim().toLowerCase();

    return groupedCompanies
      .map((company) => {
        const filteredItems = company.items.filter((device) => {
          if (!filterByMode(device)) return false;
          if (!query) return true;
          return getDeviceSearchText(device).includes(query) || company.name.toLowerCase().includes(query);
        });

        return {
          ...company,
          items: filteredItems
        };
      })
      .filter((company) => company.items.length > 0 || (!query && currentFilter === 'all'));
  }

  function buildDeviceCard(device) {
    const status = getStatusTone(device);
    const markerColor = getMarkerColor(device);
    const arrowUrl = `../assets/markers/flecha_${markerColor}.png`;
    const iconUrl = getMarkerUrl(device, markerColor);
    const title = escapeHtml(device.vehicleName || device.name || 'Unidad');
    const ts = escapeHtml(device.fixTime ? new Date(device.fixTime).toLocaleString() : 'Sin fecha visible');
    const address = escapeHtml(getAddressLabel(device));

    return `
      <article class="fleet-device-card fleet-device-card--${status.color}" data-device-sheet-id="${escapeHtml(device.deviceId)}" tabindex="0" role="button" aria-label="Abrir acciones de ${title}">
        <div class="fleet-device-card__arrow-strip">
          <img src="${arrowUrl}" alt="estado" onerror="this.style.display='none'" />
        </div>
        <div class="fleet-device-card__content">
          <div class="fleet-device-card__title-row">
            <img class="fleet-device-card__vehicle-icon" src="${iconUrl}" alt="unidad" onerror="this.style.display='none'" />
            <div class="fleet-device-card__title">${title}</div>
          </div>
          <div class="fleet-device-card__meta">${status.label} | ${ts}</div>
          <div class="fleet-device-card__meta">Dirección: ${address}</div>
        </div>
        <div class="fleet-device-card__speed">${formatSpeed(device.speedKmh)}</div>
      </article>
    `;
  }

  function openDeviceActionsSheet(device) {
    if (!deviceActionsSheet || !deviceActionsSheetTitle) {
      return;
    }

    activeSheetDeviceId = String(device?.deviceId || '');
    deviceActionsSheetTitle.textContent = String(device?.vehicleName || device?.name || 'Unidad');
    deviceActionsSheet.hidden = false;
  }

  function restoreRequestedDeviceSheet() {
    const requestedDeviceId = String(currentUrl.searchParams.get('openSheetDeviceId') || '').trim();
    if (!requestedDeviceId) {
      return;
    }

    const device = currentDevices.find((item) => String(item.deviceId) === requestedDeviceId);
    if (!device) {
      return;
    }

    const deviceCompany = String(device.groupName || device.companyName || '').trim();
    if (deviceCompany) {
      expandedCompany = deviceCompany;
      renderCompanies();
    }

    openDeviceActionsSheet(device);
    currentUrl.searchParams.delete('openSheetDeviceId');
    window.history.replaceState({}, document.title, currentUrl.pathname + (currentUrl.search ? currentUrl.search : ''));
  }

  function closeDeviceActionsSheet() {
    if (!deviceActionsSheet) {
      return;
    }

    deviceActionsSheet.hidden = true;
  }

  function getActiveSheetDevice() {
    if (!activeSheetDeviceId) {
      return null;
    }

    return currentDevices.find((item) => String(item.deviceId) === activeSheetDeviceId) || null;
  }

  function openReportsModal() {
    if (deviceReportsModal) {
      deviceReportsModal.hidden = false;
    }
  }

  function closeReportsModal() {
    if (deviceReportsModal) {
      deviceReportsModal.hidden = true;
    }
  }

  function formatDateInputValue(date) {
    const current = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(current.getTime())) {
      return '';
    }

    const pad = (value) => String(value).padStart(2, '0');
    return `${pad(current.getDate())}/${pad(current.getMonth() + 1)}/${current.getFullYear()}`;
  }

  function formatTimeInputValue(date) {
    const current = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(current.getTime())) {
      return '';
    }

    const pad = (value) => String(value).padStart(2, '0');
    return `${pad(current.getHours())}:${pad(current.getMinutes())}`;
  }

  function parseReportDateTime(dateText, timeText) {
    const dateMatch = String(dateText || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const timeMatch = String(timeText || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!dateMatch || !timeMatch) {
      return null;
    }

    const day = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const year = Number(dateMatch[3]);
    const hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);

    const parsed = new Date(year, month - 1, day, hours, minutes, 0, 0);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day ||
      parsed.getHours() !== hours ||
      parsed.getMinutes() !== minutes
    ) {
      return null;
    }

    return parsed;
  }

  function getDefaultReportRange() {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    return {
      fromDate: formatDateInputValue(start),
      fromTime: formatTimeInputValue(start),
      toDate: formatDateInputValue(now),
      toTime: formatTimeInputValue(now)
    };
  }

  function resetReportRequestSubmitState() {
    if (!deviceReportRequestAccept) {
      return;
    }

    deviceReportRequestAccept.disabled = false;
    deviceReportRequestAccept.textContent = 'Generar PDF';
  }

  function openReportRequestModal(reportConfig) {
    if (
      !deviceReportRequestModal ||
      !deviceReportRequestFromDate ||
      !deviceReportRequestFromTime ||
      !deviceReportRequestToDate ||
      !deviceReportRequestToTime
    ) {
      return;
    }

    activeReportRequest = reportConfig || null;
    const range = getDefaultReportRange();
    deviceReportRequestTitle.textContent = reportConfig?.cardLabel || 'Generar reporte';
    deviceReportRequestSubtitle.textContent = reportConfig?.subtitle || 'Selecciona el rango para exportar el PDF.';
    deviceReportRequestFromDate.value = range.fromDate;
    deviceReportRequestFromTime.value = range.fromTime;
    deviceReportRequestToDate.value = range.toDate;
    deviceReportRequestToTime.value = range.toTime;
    resetReportRequestSubmitState();
    deviceReportRequestModal.hidden = false;
  }

  function closeReportRequestModal(options = {}) {
    if (deviceReportRequestModal) {
      deviceReportRequestModal.hidden = true;
    }

    if (!options.keepContext) {
      activeReportRequest = null;
    }
  }

  function reopenReportsModal() {
    closeReportRequestModal({ keepContext: true });
    openReportsModal();
  }

  function openBlobReport(result, fallbackName) {
    if (!result?.blob) {
      return;
    }

    const objectUrl = window.URL.createObjectURL(result.blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.target = '_blank';
    anchor.rel = 'noopener';
    anchor.download = result.fileName || fallbackName || 'reporte.pdf';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => {
      window.URL.revokeObjectURL(objectUrl);
    }, 60000);
  }

  function openNativeReportUrl(url) {
    const safeUrl = String(url || '').trim();
    if (!safeUrl) {
      return false;
    }

    try {
      const isNativeCapacitor = Boolean(
        window.Capacitor?.isNativePlatform?.() ||
        window.CapacitorAndroid ||
        window.webkit?.messageHandlers?.bridge
      );

      if (!isNativeCapacitor) {
        return false;
      }

      window.open(safeUrl, '_blank', 'noopener,noreferrer');
      return true;
    } catch {
      return false;
    }
  }

  function openEditModal(device) {
    if (!deviceEditModal || !deviceEditNameInput) {
      return;
    }

    deviceEditNameInput.value = String(device?.vehicleName || device?.name || '');
    deviceEditModal.hidden = false;
  }

  function closeEditModal() {
    if (deviceEditModal) {
      deviceEditModal.hidden = true;
    }
  }

  function resetEditSubmitState() {
    if (!deviceEditAccept) {
      return;
    }

    deviceEditAccept.disabled = false;
    deviceEditAccept.textContent = 'Aceptar';
  }

  function applyUpdatedDeviceName(device, nextName) {
    if (!device || !nextName) {
      return;
    }

    device.vehicleName = nextName;
    device.name = nextName;

    const selectedDevice = apiClient?.getSelectedDevice?.();
    if (selectedDevice && String(selectedDevice.deviceId) === String(device.deviceId)) {
      selectedDevice.vehicleName = nextName;
      selectedDevice.name = nextName;
      apiClient?.storeSelectedDevice?.(selectedDevice);
    }

    buildGroups(currentDevices);
    renderCompanies();
    if (deviceActionsSheetTitle) {
      deviceActionsSheetTitle.textContent = nextName;
    }
  }

  function navigateToMap(device, action = '') {
    if (!device?.deviceId) {
      return;
    }

    apiClient?.storeSelectedDevice?.(device);
    const params = new URLSearchParams({
      deviceId: String(device.deviceId),
      from: 'devices',
      returnTo: 'device-sheet'
    });

    if (action) {
      params.set('action', action);
    }

    window.location.href = `./map.html?${params.toString()}`;
  }

  function navigateToRoutes(device) {
    if (!device?.deviceId) {
      return;
    }

    const now = new Date();
    const before = new Date(now.getTime() - (4 * 60 * 60 * 1000));
    apiClient?.storeSelectedDevice?.(device);
    apiClient?.storeRouteContext?.({
      deviceId: String(device.deviceId),
      from: before.toISOString(),
      to: now.toISOString()
    });
    const params = new URLSearchParams({
      deviceId: String(device.deviceId),
      from: 'devices',
      returnTo: 'device-sheet'
    });
    window.location.href = `./routes.html?${params.toString()}`;
  }

  function handleSheetAction(action) {
    const device = getActiveSheetDevice();
    if (!device) {
      return;
    }

    if (action === 'location') {
      closeDeviceActionsSheet();
      navigateToMap(device, 'location');
      return;
    }

    if (action === 'info') {
      closeDeviceActionsSheet();
      navigateToMap(device, 'info');
      return;
    }

    if (action === 'playback') {
      closeDeviceActionsSheet();
      navigateToRoutes(device);
      return;
    }

    if (action === 'geofence') {
      closeDeviceActionsSheet();
      navigateToMap(device, 'geofences');
      return;
    }

    if (action === 'report') {
      openReportsModal();
      return;
    }

    if (action === 'command') {
      closeDeviceActionsSheet();
      navigateToMap(device, 'command');
      return;
    }

    if (action === 'edit') {
      openEditModal(device);
    }
  }

  function handleReportCard(action) {
    const device = getActiveSheetDevice();
    if (!device) {
      return;
    }

    if (action === 'events') {
      window.alert('El generador PDF de Eventos aún no está disponible en la plataforma.');
      return;
    }

    if (action === 'geofences') {
      window.alert('El generador PDF de Geocercas aún no está disponible en la plataforma.');
      return;
    }

    const reportConfig = REPORT_CARD_CONFIG[action];
    if (reportConfig) {
      closeReportsModal();
      openReportRequestModal(reportConfig);
    }
  }

  async function submitReportRequest() {
    const device = getActiveSheetDevice();
    if (
      !device ||
      !activeReportRequest ||
      !deviceReportRequestFromDate ||
      !deviceReportRequestFromTime ||
      !deviceReportRequestToDate ||
      !deviceReportRequestToTime ||
      !deviceReportRequestAccept
    ) {
      closeReportRequestModal();
      return;
    }

    const fromDate = parseReportDateTime(deviceReportRequestFromDate.value, deviceReportRequestFromTime.value);
    const toDate = parseReportDateTime(deviceReportRequestToDate.value, deviceReportRequestToTime.value);

    if (!fromDate || !toDate || Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || toDate <= fromDate) {
      window.alert('Selecciona una fecha y hora válidas para generar el reporte.');
      return;
    }

    deviceReportRequestAccept.disabled = true;
    deviceReportRequestAccept.textContent = 'Generando...';

    try {
      const reportRequest = {
        type: activeReportRequest.type,
        format: 'PDF',
        title: activeReportRequest.title,
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        deviceIds: [Number(device.deviceId)],
        stopMinMinutes: 3,
        stopSpeedKmh: 1,
        emails: ''
      };

      const nativeUrl = apiClient?.buildReportDownloadUrl?.(reportRequest);
      const openedNatively = openNativeReportUrl(nativeUrl);

      if (!openedNatively) {
        const result = await apiClient?.generateReport?.(reportRequest);
        if (!result?.blob) {
          throw new Error('La plataforma no devolvio el PDF del reporte.');
        }
        openBlobReport(result, `${activeReportRequest.title || 'reporte'}.pdf`);
      }

      closeReportRequestModal();
      closeDeviceActionsSheet();
      activeReportRequest = null;
    } catch (error) {
      window.alert(error?.userMessage || error?.message || 'No fue posible generar el reporte.');
      resetReportRequestSubmitState();
    }
  }

  function renderCompanies() {
    if (!companyList) return;

    const companies = getFilteredCompanies();
    if (!companies.length) {
      companyList.innerHTML = '<div class="mobile-map-empty">No hay dispositivos para el filtro actual.</div>';
      return;
    }

    companyList.innerHTML = companies.map((company) => {
      const expanded = expandedCompany === company.name;
      const itemsMarkup = expanded
        ? company.items.map((device) => buildDeviceCard(device)).join('')
        : '';

      return `
        <section class="fleet-company-block${expanded ? ' fleet-company-block--open' : ''}">
          <button class="fleet-company-header" type="button" data-company-name="${escapeHtml(company.name)}">
            <span class="fleet-company-header__name">${escapeHtml(company.name)}</span>
            <span class="fleet-company-header__count">${company.items.length}</span>
            <span class="fleet-company-header__chevron">${expanded ? '&#9662;' : '&#8250;'}</span>
          </button>
          <div class="fleet-company-devices${expanded ? ' fleet-company-devices--open' : ''}">
            ${itemsMarkup}
          </div>
        </section>
      `;
    }).join('');

    companyList.querySelectorAll('[data-company-name]').forEach((button) => {
      button.addEventListener('click', () => {
        const companyName = button.getAttribute('data-company-name') || '';
        expandedCompany = expandedCompany === companyName ? '' : companyName;
        renderCompanies();
      });
    });

    companyList.querySelectorAll('[data-device-sheet-id]').forEach((card) => {
      const openSheet = () => {
        const deviceId = String(card.getAttribute('data-device-sheet-id') || '');
        const device = currentDevices.find((item) => String(item.deviceId) === deviceId);
        if (!device) {
          return;
        }

        apiClient?.storeSelectedDevice?.(device);
        openDeviceActionsSheet(device);
      };

      card.addEventListener('click', openSheet);
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openSheet();
        }
      });
    });

    companyList.querySelectorAll('[data-device-action]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const deviceId = String(button.getAttribute('data-device-id') || '');
        const device = currentDevices.find((item) => String(item.deviceId) === deviceId);
        if (!device) {
          return;
        }

        apiClient?.storeSelectedDevice?.(device);

        if (button.getAttribute('data-device-action') === 'map') {
          appShell?.navigate?.('./map.html', { deviceId, from: 'devices' });
          return;
        }

        const now = new Date();
        const before = new Date(now.getTime() - (4 * 60 * 60 * 1000));
        apiClient?.storeRouteContext?.({
          deviceId,
          from: before.toISOString(),
          to: now.toISOString()
        });
        appShell?.navigate?.('./routes.html', { deviceId, from: 'devices' });
      });
    });
  }

  async function loadDevices() {
    if (!apiClient) return;
    companyList.innerHTML = createLoadingMarkup();

    try {
      const session = await appShell?.requireSession?.({
        redirectOnMissing: true
      });

      if (!session) {
        companyList.innerHTML = '<div class="mobile-map-empty">Inicia sesión para ver la flota.</div>';
        renderSummary([]);
        return;
      }

      const dashboard = await apiClient.getDashboard();
      currentDevices = Array.isArray(dashboard.devices) ? dashboard.devices : [];
      buildGroups(currentDevices);
      renderSummary(currentDevices);
      if (!expandedCompany && groupedCompanies.length) {
        expandedCompany = groupedCompanies[0].name;
      }
      renderCompanies();
      restoreRequestedDeviceSheet();
      scheduleGeocodeRefreshIfNeeded(currentDevices);
    } catch (_error) {
      companyList.innerHTML = '<div class="mobile-map-empty">No fue posible cargar los dispositivos.</div>';
      renderSummary([]);
    }
  }

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      currentFilter = button.dataset.deviceFilter || 'all';
      filterButtons.forEach((item) => item.classList.toggle('mobile-devices-filter--active', item === button));
      renderCompanies();
    });
  });

  searchInput?.addEventListener('input', renderCompanies);
  deviceActionsSheetBackdrop?.addEventListener('click', closeDeviceActionsSheet);
  deviceActionsSheetClose?.addEventListener('click', closeDeviceActionsSheet);
  deviceActionsSheet?.querySelectorAll('[data-device-sheet-action]').forEach((button) => {
    button.addEventListener('click', () => {
      handleSheetAction(button.getAttribute('data-device-sheet-action') || '');
    });
  });
  deviceReportsBackdrop?.addEventListener('click', closeReportsModal);
  deviceReportsBack?.addEventListener('click', closeReportsModal);
  deviceReportsModal?.querySelectorAll('[data-report-card]').forEach((button) => {
    button.addEventListener('click', () => {
      handleReportCard(button.getAttribute('data-report-card') || '');
    });
  });
  deviceReportRequestBackdrop?.addEventListener('click', reopenReportsModal);
  deviceReportRequestBack?.addEventListener('click', reopenReportsModal);
  deviceReportRequestCancel?.addEventListener('click', reopenReportsModal);
  deviceReportRequestAccept?.addEventListener('click', submitReportRequest);
  deviceEditBackdrop?.addEventListener('click', () => {
    deviceRenameAbortController?.abort();
    deviceRenameAbortController = null;
    resetEditSubmitState();
    closeEditModal();
  });
  deviceEditCancel?.addEventListener('click', () => {
    deviceRenameAbortController?.abort();
    deviceRenameAbortController = null;
    resetEditSubmitState();
    closeEditModal();
  });
  deviceEditAccept?.addEventListener('click', () => {
    const device = getActiveSheetDevice();
    if (!device || !deviceEditNameInput) {
      closeEditModal();
      return;
    }

    const nextName = String(deviceEditNameInput.value || '').trim();
    if (!nextName || nextName === String(device.vehicleName || device.name || '').trim()) {
      closeEditModal();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      deviceRenameAbortController?.abort();
    }, 15000);
    deviceRenameAbortController = new AbortController();
    closeEditModal();

    Promise.resolve(
      apiClient?.updateDeviceName?.(
        device.deviceId,
        nextName,
        device.uniqueId || '',
        deviceRenameAbortController.signal
      )
    )
      .then(() => {
        applyUpdatedDeviceName(device, nextName);
      })
      .catch(() => {
        // El apiClient ya emite el mensaje centralizado de error.
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        deviceRenameAbortController = null;
        resetEditSubmitState();
      });
  });

  loadDevices();
})();
