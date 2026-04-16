(function () {
  const apiClient = window.GpsRastreoApi;
  const searchInput = document.getElementById('devicesSearch');
  const companyList = document.getElementById('devicesCompanyList');
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
    const speed = Number(device?.speedKmh || 0);
    if (speed > 3) return 'verde';
    if (speed > 0) return 'amarillo';
    return 'rojo';
  }

  function getStatusTone(device) {
    const speed = Number(device?.speedKmh || 0);
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
    const iconUrl = getMarkerUrl(device, markerColor);
    const arrowUrl = `../assets/markers/flecha_${markerColor}.png`;
    const title = escapeHtml(device.vehicleName || device.name || 'Unidad');
    const ts = escapeHtml(device.fixTime || '-');
    const distance = Number(device.odometroInicialKm || 0);

    return `
      <article class="fleet-device-card fleet-device-card--${status.color}">
        <div class="fleet-device-card__arrow-strip">
          <img src="${arrowUrl}" alt="estado" onerror="this.style.display='none'" />
        </div>
        <div class="fleet-device-card__content">
          <div class="fleet-device-card__title">${title}</div>
          <div class="fleet-device-card__meta">${ts}</div>
          <div class="fleet-device-card__meta">Duracion de la parada: ${status.key === 'moving' ? 'en movimiento' : 'sin dato'}</div>
          <div class="fleet-device-card__meta">Distancia recorrida: ${distance ? `${distance.toFixed(2)} Km` : 'sin dato'}</div>
          <div class="fleet-device-card__link">Mostrar direccion</div>
          <div class="fleet-device-card__sensors">
            <span>IMEI ${escapeHtml(device.uniqueId || '-')}</span>
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
  }

  async function loadDevices() {
    if (!apiClient) return;

    try {
      const session = await apiClient.getSessionInfo();
      if (!session) {
        companyList.innerHTML = '<div class="mobile-map-empty">Inicia sesion para ver la flota.</div>';
        return;
      }

      const dashboard = await apiClient.getDashboard();
      currentDevices = Array.isArray(dashboard.devices) ? dashboard.devices : [];
      buildGroups(currentDevices);
      if (!expandedCompany && groupedCompanies.length) {
        expandedCompany = groupedCompanies[0].name;
      }
      renderCompanies();
    } catch (_error) {
      companyList.innerHTML = '<div class="mobile-map-empty">No fue posible cargar los dispositivos.</div>';
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
