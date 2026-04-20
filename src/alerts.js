(function () {
  const apiClient = window.GpsRastreoApi;

  const sessionTitle = document.getElementById('alertsSessionTitle');
  const sessionText = document.getElementById('alertsSessionText');
  const refreshButton = document.getElementById('refreshAlertsButton');
  const searchInput = document.getElementById('alertsSearch');
  const summary = document.getElementById('alertsSummary');
  const eventsList = document.getElementById('alertsEventsList');

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
    if (!query) {
      renderEvents(currentEvents);
      return;
    }

    const filtered = currentEvents.filter((eventItem) => {
      const haystack = [
        eventItem.vehicleName,
        eventItem.eventType,
        eventItem.address
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(query);
    });

    renderEvents(filtered);
  }

  async function loadEvents() {
    if (!apiClient) {
      return;
    }

    try {
      const session = await apiClient.getSessionInfo();
      if (!session) {
        sessionTitle.textContent = 'Sin sesion activa';
        sessionText.textContent = 'Inicia sesion desde login.html para consultar eventos recientes.';
        currentEvents = [];
        renderSummary([]);
        renderEvents([]);
        return;
      }

      sessionTitle.textContent = session.mode === 'live' ? 'Sesion real detectada' : 'Sesion mock detectada';
      sessionText.textContent = `SessionId activa: ${session.id}. Consultando eventos recientes del monitor.`;

      const payload = await apiClient.getRecentEvents(40);
      currentEvents = Array.isArray(payload.items) ? payload.items : [];
      renderSummary(currentEvents);
      applyFilter();
    } catch (_error) {
      sessionTitle.textContent = 'No fue posible cargar eventos';
      sessionText.textContent = 'Revisa la sesion, el backend o la conectividad con el portal.';
      currentEvents = [];
      renderSummary([]);
      renderEvents([]);
    }
  }

  searchInput?.addEventListener('input', applyFilter);
  refreshButton?.addEventListener('click', loadEvents);

  loadEvents();
})();
