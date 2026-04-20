(function () {
  const apiClient = window.GpsRastreoApi;

  const refreshButton = document.getElementById('refreshAlertsButton');
  const searchInput = document.getElementById('alertsSearch');
  const typeFilter = document.getElementById('alertsTypeFilter');
  const summary = document.getElementById('alertsSummary');
  const eventsList = document.getElementById('alertsEventsList');
  const appShell = window.GpsRastreoShell;

  let currentEvents = [];

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function formatDateTime(value) {
    if (!value) {
      return 'Sin fecha visible';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return 'Sin fecha visible';
    }

    return parsed.toLocaleString();
  }

  function getEventTone(eventItem) {
    const eventType = String(eventItem?.eventType || '').toUpperCase();
    if (eventType.includes('ENCENDIDO')) {
      return { accent: 'green', icon: 'power', label: 'Encendido' };
    }
    if (eventType.includes('APAGADO')) {
      return { accent: 'red', icon: 'power-off', label: 'Apagado' };
    }
    if (eventType.includes('VELOCIDAD')) {
      return { accent: 'orange', icon: 'speed', label: 'Velocidad' };
    }
    if (eventType.includes('GEOCERCA')) {
      return { accent: 'blue', icon: 'geo', label: 'Geocerca' };
    }

    return { accent: 'gray', icon: 'event', label: 'Evento' };
  }

  function renderSummary(events) {
    if (!summary) {
      return;
    }

    const poweredOn = events.filter((item) => String(item.eventType || '').toUpperCase().includes('ENCENDIDO')).length;
    const poweredOff = events.filter((item) => String(item.eventType || '').toUpperCase().includes('APAGADO')).length;

    summary.innerHTML = `
      <article class="mobile-events-kpi">
        <span>Recientes</span>
        <strong>${events.length}</strong>
      </article>
      <article class="mobile-events-kpi">
        <span>Encendidos</span>
        <strong>${poweredOn}</strong>
      </article>
      <article class="mobile-events-kpi">
        <span>Apagados</span>
        <strong>${poweredOff}</strong>
      </article>
    `;
  }

  function renderTypeOptions(events) {
    if (!typeFilter) {
      return;
    }

    const currentValue = typeFilter.value || 'all';
    const types = [...new Set(events.map((item) => String(item.eventType || '').trim()).filter(Boolean))];

    typeFilter.innerHTML = [
      '<option value="all">Todos</option>',
      ...types.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
    ].join('');

    typeFilter.value = types.includes(currentValue) || currentValue === 'all'
      ? currentValue
      : 'all';
  }

  function renderEvents(events) {
    if (!eventsList) {
      return;
    }

    if (!events.length) {
      eventsList.innerHTML = '<div class="mobile-map-empty">No hay eventos para el filtro actual.</div>';
      return;
    }

    eventsList.innerHTML = events.map((eventItem) => {
      const tone = getEventTone(eventItem);
      return `
        <button class="mobile-event-card mobile-event-card--${tone.accent}" type="button" data-event-id="${escapeHtml(eventItem.eventId)}">
          <div class="mobile-event-card__icon mobile-event-card__icon--${tone.accent}">
            <span>${tone.label}</span>
          </div>
          <div class="mobile-event-card__body">
            <strong>${escapeHtml(eventItem.vehicleName || 'Unidad')}</strong>
            <span>${escapeHtml(eventItem.eventType || 'Evento')}</span>
            <small>${escapeHtml(formatDateTime(eventItem.eventTime))}</small>
          </div>
          <div class="mobile-event-card__meta">
            <span>${Math.round(Number(eventItem.speed || 0))} kph</span>
            <strong>&#8250;</strong>
          </div>
        </button>
      `;
    }).join('');

    eventsList.querySelectorAll('[data-event-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const eventId = button.getAttribute('data-event-id');
        const selected = currentEvents.find((item) => String(item.eventId) === String(eventId));
        if (!selected) {
          return;
        }

        apiClient?.storeSelectedEvent?.(selected);
        window.location.href = `./map.html?eventId=${encodeURIComponent(selected.eventId)}&from=events`;
      });
    });
  }

  function applyFilter() {
    const query = String(searchInput?.value || '').trim().toLowerCase();
    const selectedType = String(typeFilter?.value || 'all').trim();
    const filtered = currentEvents.filter((eventItem) => {
      const haystack = [
        eventItem.vehicleName,
        eventItem.eventType,
        eventItem.address
      ].filter(Boolean).join(' ').toLowerCase();

      const matchesQuery = !query || haystack.includes(query);
      const matchesType = selectedType === 'all' || String(eventItem.eventType || '').trim() === selectedType;
      return matchesQuery && matchesType;
    });

    renderEvents(filtered);
  }

  async function loadEvents() {
    if (!apiClient) {
      return;
    }

    try {
      const session = await appShell?.requireSession?.({
        redirectOnMissing: true
      });

      if (!session) {
        currentEvents = [];
        renderSummary([]);
        renderTypeOptions([]);
        renderEvents([]);
        return;
      }

      const payload = await apiClient.getRecentEvents(40);
      currentEvents = Array.isArray(payload.items) ? payload.items : [];
      renderSummary(currentEvents);
      renderTypeOptions(currentEvents);
      applyFilter();
    } catch (_error) {
      currentEvents = [];
      renderSummary([]);
      renderTypeOptions([]);
      renderEvents([]);
    }
  }

  searchInput?.addEventListener('input', applyFilter);
  typeFilter?.addEventListener('change', applyFilter);
  refreshButton?.addEventListener('click', loadEvents);

  loadEvents();
})();
