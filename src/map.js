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

  let liveMap = null;
  let liveMapMarkers = [];
  let currentDevices = [];
  let currentCompanies = [];
  let currentTab = 'devices';
  let activeCompany = '';

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replaceAll('`', '&#96;');
  }

  function formatSpeed(speed) {
    return `${Math.round(Number(speed || 0))} kph`;
  }

  function parseFixTime(value) {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function pickMarkerColor(device) {
    const speed = Number(device?.speedKmh || 0);
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
    const color = pickMarkerColor(device);
    if (color === 'verde') {
      return { label: 'Movimiento', tone: 'moving', accent: 'green' };
    }
    if (color === 'amarillo') {
      return { label: 'Reposo', tone: 'idle', accent: 'yellow' };
    }
    if (color === 'gris') {
      return { label: 'Sin señal', tone: 'offline', accent: 'gray' };
    }
    return { label: 'Detenido', tone: 'stopped', accent: 'red' };
  }

  function getMarkerBase(device) {
    return String(device?.iconBase || 'flecha').trim() || 'flecha';
  }

  function getMarkerUrl(device) {
    return `../assets/markers/${getMarkerBase(device)}_${pickMarkerColor(device)}.png`;
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
    const markerUrl = getMarkerUrl(device);
    const fallbackUrl = `../assets/markers/flecha_${pickMarkerColor(device)}.png`;

    return window.L.divIcon({
      className: 'gps-marker-real',
      html: `
        <div class="gps-marker-real__shell">
          <img class="gps-marker-real__img" src="${markerUrl}" alt="vehiculo" onerror="this.onerror=null;this.src='${fallbackUrl}'" />
        </div>
      `,
      iconSize: [52, 52],
      iconAnchor: [26, 26],
      popupAnchor: [0, -18]
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
    const fallbackUrl = `../assets/markers/flecha_${pickMarkerColor(device)}.png`;

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
          <img class="mobile-vehicle-card__arrow" src="../assets/markers/flecha_${pickMarkerColor(device)}.png" alt="estado" onerror="this.style.display='none'" />
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
          <span>Velocidad: ${formatSpeed(device.speedKmh)}</span>
        </div>
      `);

      liveMapMarkers.push(marker);
      bounds.push([lat, lon]);
    });

    if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    } else {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
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
        updateCounters([], { active: 0 });
        renderDeviceList([]);
        renderCompanyList();
        renderMap([]);
        return;
      }

      const dashboard = await apiClient.getDashboard();
      currentDevices = Array.isArray(dashboard.devices) ? dashboard.devices : [];
      deriveCompanies(currentDevices);
      updateCounters(currentDevices, dashboard.alertSummary);
      renderDeviceList(filterDevices());
      renderCompanyList();
      renderMap(currentDevices);
    } catch (_error) {
      currentDevices = [];
      currentCompanies = [];
      updateCounters([], { active: 0 });
      renderDeviceList([]);
      renderCompanyList();
      renderMap([]);
    }
  }

  if (menuButton) {
    menuButton.addEventListener('click', () => {
      const isOpen = sheet?.classList.contains('mobile-map-sheet--open');
      setSheetOpen(!isOpen);
    });
  }

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
    const withLocation = currentDevices.filter((item) => Number.isFinite(Number(item?.lat)) && Number.isFinite(Number(item?.lon)));
    if (!withLocation.length || !liveMap) {
      return;
    }

    liveMap.setView([Number(withLocation[0].lat), Number(withLocation[0].lon)], 15);
  });

  sheet?.addEventListener('wheel', (event) => {
    event.stopPropagation();
  }, { passive: true });

  switchTab('devices');
  loadMapPage();
})();

