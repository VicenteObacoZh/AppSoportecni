(function () {
  const apiClient = window.GpsRastreoApi;

  const sessionTitle = document.getElementById('alertsSessionTitle');
  const sessionText = document.getElementById('alertsSessionText');
  const refreshButton = document.getElementById('refreshAlertsButton');
  const searchInput = document.getElementById('alertsSearch');
  const summary = document.getElementById('alertsSummary');
  const tableBody = document.getElementById('alertsTableBody');

  let currentAlerts = [];

  function getStatus(alert) {
    return alert?.activo
      ? { label: 'Activa', tone: 'success' }
      : { label: 'Inactiva', tone: 'muted' };
  }

  function renderSummary(alerts, totals) {
    if (!summary) {
      return;
    }

    summary.innerHTML = `
      <article class="widget">
        <p class="eyebrow">Total</p>
        <h3>${totals.total}</h3>
        <p>Alertas visibles en el portal.</p>
      </article>
      <article class="widget">
        <p class="eyebrow">Activas</p>
        <h3>${totals.active}</h3>
        <p>Reglas operativas listas para disparar eventos.</p>
      </article>
      <article class="widget">
        <p class="eyebrow">Tipos</p>
        <h3>${totals.types}</h3>
        <p>Variedad de configuraciones detectadas.</p>
      </article>
    `;
  }

  function renderTable(alerts) {
    if (!tableBody) {
      return;
    }

    if (!alerts.length) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="4">No hay alertas que coincidan con el filtro actual.</td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = alerts.map((alert) => {
      const status = getStatus(alert);
      return `
        <tr>
          <td><strong>${alert.nombre || 'Alerta'}</strong></td>
          <td>${alert.tipo || 'Sin tipo'}</td>
          <td><span class="event-badge event-badge--${status.tone}">${status.label}</span></td>
          <td>${alert.dispositivos || 0}</td>
        </tr>
      `;
    }).join('');
  }

  function applyFilter() {
    const query = String(searchInput?.value || '').trim().toLowerCase();
    if (!query) {
      renderTable(currentAlerts);
      return;
    }

    const filtered = currentAlerts.filter((alert) => {
      const haystack = [
        alert.nombre,
        alert.tipo
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(query);
    });

    renderTable(filtered);
  }

  async function loadAlerts() {
    if (!apiClient) {
      return;
    }

    try {
      const session = await apiClient.getSessionInfo();
      if (!session) {
        sessionTitle.textContent = 'Sin sesion activa';
        sessionText.textContent = 'Inicia sesion desde login.html para consultar las alertas reales.';
        currentAlerts = [];
        renderSummary([], { total: 0, active: 0, types: 0 });
        renderTable([]);
        return;
      }

      sessionTitle.textContent = 'Sesion real detectada';
      sessionText.textContent = `SessionId activa: ${session.id}. Consultando configuraciones del modulo Alertas.`;

      const payload = await apiClient.getAlerts();
      currentAlerts = Array.isArray(payload.items) ? payload.items : [];
      renderSummary(currentAlerts, {
        total: Number(payload.summary?.total || 0),
        active: Number(payload.summary?.active || 0),
        types: Number(payload.summary?.types || 0)
      });
      applyFilter();
    } catch (_error) {
      sessionTitle.textContent = 'No fue posible cargar alertas';
      sessionText.textContent = 'Revisa la sesion, el backend o la conectividad con el portal.';
      currentAlerts = [];
      renderSummary([], { total: 0, active: 0, types: 0 });
      renderTable([]);
    }
  }

  if (searchInput) {
    searchInput.addEventListener('input', applyFilter);
  }

  if (refreshButton) {
    refreshButton.addEventListener('click', loadAlerts);
  }

  loadAlerts();
})();
