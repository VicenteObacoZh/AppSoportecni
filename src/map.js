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
  const alertsButton = document.getElementById('mapAlertsButton');
  const routesButton = document.getElementById('mapRoutesButton');
  const headerTitle = document.getElementById('mapHeaderTitle');
  const backButton = document.getElementById('mapBackButton');
  const eventPanel = document.getElementById('mapEventPanel');
  const eventType = document.getElementById('mapEventType');
  const eventSpeed = document.getElementById('mapEventSpeed');
  const eventTime = document.getElementById('mapEventTime');
  const eventAddressButton = document.getElementById('mapEventAddressButton');
  const eventAddressText = document.getElementById('mapEventAddressText');

  let liveMap = null;
  let renderMarkers = [];
  let eventFocusMarker = null;
  let currentDevices = [];
  let currentCompanies = [];
  let currentTab = 'devices';
  let activeCompany = '';
  let currentAlertSummary = null;
  let selectedEvent = null;

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

  function parseFixTime(value) {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function getStatusColor(device) {
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

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(liveMap);

      liveMap.on('zoomend moveend', () => {
        renderMap(currentDevices);
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

  function clearEventFocusMarker() {
    if (eventFocusMarker) {
      eventFocusMarker.remove();
      eventFocusMarker = null;
    }
  }

  function buildDeviceIcon(device) {
    const markerUrl = getMarkerUrl(device);
    const fallbackUrl = `../assets/markers/flecha_${getStatusColor(device)}.png`;

    return window.L.divIcon({
      className: 'gps-marker-real',
      html: `
        <div class="gps-marker-real__shell">
          <img class="gps-marker-real__img" src="${markerUrl}" alt="vehiculo" onerror="this.onerror=null;this.src='${fallbackUrl}'" />
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
      iconSize: variant === 'large' ? [70, 70] : [58, 58],
      iconAnchor: variant === 'large' ? [35, 35] : [29, 29]
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
      if (!matchesCompany) {
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
      <button class="mobile-vehicle-card mobile-vehicle-card--${status.accent}${compact ? ' mobile-vehicle-card--compact' : ''}" type="button" data-device-lat="${device.lat ?? ''}" data-device-lon="${device.lon ?? ''}">
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
    root.querySelectorAll('[data-device-lat]').forEach((button) => {
      button.addEventListener('click', () => {
        const lat = Number(button.getAttribute('data-device-lat'));
        const lon = Number(button.getAttribute('data-device-lon'));
        if (Number.isFinite(lat) && Number.isFinite(lon) && liveMap) {
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
      icon: buildDeviceIcon(device)
    }).addTo(liveMap);

    marker.bindPopup(`
      <div class="gps-popup">
        <strong>${escapeHtml(device.vehicleName || device.name || 'Unidad')}</strong>
        <span>Empresa: ${escapeHtml(device.groupName || 'Sin empresa')}</span>
        <span>IMEI: ${escapeHtml(device.uniqueId || '-')}</span>
        <span>Velocidad: ${formatSpeed(device.speedKmh)}</span>
      </div>
    `);

    renderMarkers.push(marker);
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
        <span>${escapeHtml(selectedEvent.eventType || 'Evento')}</span>
        <span>${escapeHtml(formatDateTime(selectedEvent.eventTime))}</span>
      </div>
    `).openPopup();
  }

  function renderMap(devices) {
    const map = ensureMap();
    if (!map) {
      return;
    }

    clearMapMarkers();

    const withLocation = devices.filter((item) => Number.isFinite(Number(item?.lat)) && Number.isFinite(Number(item?.lon)));

    if (mapEmptyState) {
      mapEmptyState.style.display = withLocation.length > 0 ? 'none' : '';
    }

    if (!withLocation.length) {
      map.setView([-4.05, -78.92], 6);
      renderFocusedEventMarker();
      return;
    }

    const zoom = map.getZoom();

    if (selectedEvent && zoom >= 15) {
      withLocation.forEach(addDeviceMarker);
    } else if (zoom >= 15) {
      withLocation.forEach(addDeviceMarker);
    } else if (zoom >= 11) {
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

  function applyEventFocusState() {
    const hasEvent = Boolean(selectedEvent);

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
      return;
    }

    if (eventType) {
      eventType.textContent = selectedEvent.eventType || 'Evento';
    }
    if (eventSpeed) {
      eventSpeed.textContent = formatSpeed(selectedEvent.speed);
    }
    if (eventTime) {
      eventTime.textContent = formatDateTime(selectedEvent.eventTime);
    }
    if (eventAddressText) {
      eventAddressText.textContent = selectedEvent.address || 'Direccion no disponible para este evento.';
      eventAddressText.hidden = true;
    }
  }

  function resolveSelectedEvent() {
    const fromStorage = apiClient?.getSelectedEvent?.();
    const currentUrl = new URL(window.location.href);
    const eventId = currentUrl.searchParams.get('eventId');

    if (fromStorage && (!eventId || String(fromStorage.eventId) === String(eventId))) {
      return fromStorage;
    }

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

  async function loadMapPage() {
    if (!apiClient) {
      return;
    }

    try {
      const session = await apiClient.getSessionInfo();
      if (!session) {
        currentDevices = [];
        currentCompanies = [];
        currentAlertSummary = null;
        updateCounters([], { active: 0 });
        renderDeviceList([]);
        renderCompanyList();
        renderMap([]);
        applyEventFocusState();
        return;
      }

      const dashboard = await apiClient.getDashboard();
      currentDevices = Array.isArray(dashboard.devices) ? dashboard.devices : [];
      currentAlertSummary = dashboard.alertSummary || null;
      deriveCompanies(currentDevices);
      updateCounters(currentDevices, currentAlertSummary);
      renderDeviceList(filterDevices());
      renderCompanyList();
      renderMap(currentDevices);
      applyEventFocusState();

      if (selectedEvent) {
        focusSelectedEvent();
      } else if (currentDevices.length > 0 && liveMap && renderMarkers.length === 0) {
        const bounds = window.L.latLngBounds(currentDevices
          .filter((item) => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon)))
          .map((item) => [Number(item.lat), Number(item.lon)]));
        if (bounds.isValid()) {
          liveMap.fitBounds(bounds.pad(0.2));
        }
      }
    } catch (_error) {
      currentDevices = [];
      currentCompanies = [];
      currentAlertSummary = null;
      updateCounters([], { active: 0 });
      renderDeviceList([]);
      renderCompanyList();
      renderMap([]);
      applyEventFocusState();
    }
  }

  selectedEvent = resolveSelectedEvent();

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
    loadMapPage();
  });

  zoomInButton?.addEventListener('click', () => {
    ensureMap()?.zoomIn();
  });

  zoomOutButton?.addEventListener('click', () => {
    ensureMap()?.zoomOut();
  });

  locateButton?.addEventListener('click', () => {
    if (selectedEvent) {
      focusSelectedEvent();
      return;
    }

    const withLocation = currentDevices.filter((item) => Number.isFinite(Number(item?.lat)) && Number.isFinite(Number(item?.lon)));
    if (!withLocation.length || !liveMap) {
      return;
    }

    liveMap.setView([Number(withLocation[0].lat), Number(withLocation[0].lon)], 15);
  });

  alertsButton?.addEventListener('click', () => {
    window.location.href = './alerts.html';
  });

  routesButton?.addEventListener('click', () => {
    window.location.href = './routes.html';
  });

  backButton?.addEventListener('click', () => {
    apiClient?.clearSelectedEvent?.();
    window.location.href = './alerts.html';
  });

  eventAddressButton?.addEventListener('click', () => {
    if (!eventAddressText) {
      return;
    }
    eventAddressText.hidden = !eventAddressText.hidden;
  });

  sheet?.addEventListener('wheel', (event) => {
    event.stopPropagation();
  }, { passive: true });

  switchTab('devices');
  applyEventFocusState();
  loadMapPage();
})();
