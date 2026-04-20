(function () {
  const apiClient = window.GpsRastreoApi;
  const appShell = window.GpsRastreoShell;
  const searchInput = document.getElementById('devicesSearch');
  const companyList = document.getElementById('devicesCompanyList');
  const sessionTitle = document.getElementById('devicesSessionTitle');
  const sessionText = document.getElementById('devicesSessionText');
  const summary = document.getElementById('devicesSummary');
  const filterButtons = Array.from(document.querySelectorAll('[data-device-filter]'));

  let currentDevices = [];
  let groupedCompanies = [];
  let currentFilter = 'all';
  let expandedCompany = '';

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

  function getMarkerColor(device) {
    const tone = getStatusTone(device).color;
    if (tone === 'green') return 'verde';
    if (tone === 'yellow') return 'amarillo';
    if (tone === 'gray') return 'gris';
    return 'rojo';
  }

  function getStatusTone(device) {
    const speed = Number(device?.speedKmh || 0);
    const hasLocation = Number.isFinite(Number(device?.lat)) && Number.isFinite(Number(device?.lon));
    const fixTime = device?.fixTime ? new Date(device.fixTime) : null;
    const ageHours = fixTime && !Number.isNaN(fixTime.getTime())
      ? Math.abs(Date.now() - fixTime.getTime()) / 36e5
      : Number.POSITIVE_INFINITY;

    if (!hasLocation || ageHours > 24) {
      return { key: 'offline', label: 'Sin senal', color: 'gray' };
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
        <span>Total</span>
        <strong>${devices.length}</strong>
      </article>
      <article class="mobile-devices-kpi">
        <span>Movimiento</span>
        <strong>${moving}</strong>
      </article>
      <article class="mobile-devices-kpi">
        <span>Reposo</span>
        <strong>${idle}</strong>
      </article>
      <article class="mobile-devices-kpi">
        <span>Detenido / sin senal</span>
        <strong>${stopped + offline}</strong>
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
    const title = escapeHtml(device.vehicleName || device.name || 'Unidad');
    const ts = escapeHtml(device.fixTime ? new Date(device.fixTime).toLocaleString() : 'Sin fecha visible');
    const lat = Number(device.lat);
    const lon = Number(device.lon);

    return `
      <article class="fleet-device-card fleet-device-card--${status.color}">
        <div class="fleet-device-card__arrow-strip">
          <img src="${arrowUrl}" alt="estado" onerror="this.style.display='none'" />
        </div>
        <div class="fleet-device-card__content">
          <div class="fleet-device-card__title">${title}</div>
          <div class="fleet-device-card__meta">${status.label} | ${ts}</div>
          <div class="fleet-device-card__meta">Empresa: ${escapeHtml(device.groupName || 'Sin empresa')}</div>
          <div class="fleet-device-card__meta">Posicion: ${Number.isFinite(lat) && Number.isFinite(lon) ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : 'Sin coordenadas'}</div>
          <div class="fleet-device-card__sensors">
            <span>IMEI ${escapeHtml(device.uniqueId || '-')}</span>
          </div>
          <div class="fleet-device-card__actions">
            <button type="button" class="fleet-device-card__action" data-device-action="map" data-device-id="${escapeHtml(device.deviceId)}">Ver mapa</button>
            <button type="button" class="fleet-device-card__action" data-device-action="route" data-device-id="${escapeHtml(device.deviceId)}">Historico</button>
          </div>
        </div>
        <div class="fleet-device-card__speed">${formatSpeed(device.speedKmh)}</div>
      </article>
    `;
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

    try {
      const session = await appShell?.requireSession?.({
        redirectOnMissing: true,
        sessionTitleEl: sessionTitle,
        sessionTextEl: sessionText
      });

      if (!session) {
        companyList.innerHTML = '<div class="mobile-map-empty">Inicia sesion para ver la flota.</div>';
        renderSummary([]);
        return;
      }

      sessionTitle.textContent = session.mode === 'live' ? 'Sesion real detectada' : 'Sesion mock detectada';
      sessionText.textContent = `SessionId activa: ${session.id}. Flota lista para operar.`;

      const dashboard = await apiClient.getDashboard();
      currentDevices = Array.isArray(dashboard.devices) ? dashboard.devices : [];
      buildGroups(currentDevices);
      renderSummary(currentDevices);
      if (!expandedCompany && groupedCompanies.length) {
        expandedCompany = groupedCompanies[0].name;
      }
      renderCompanies();
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

  loadDevices();
})();
