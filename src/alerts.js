(function () {
  const apiClient = window.GpsRastreoApi;
  const appShell = window.GpsRastreoShell;

  const refreshButton = document.getElementById('refreshAlertsButton');
  const backButton = document.getElementById('alertsBackButton');
  const searchInput = document.getElementById('alertsSearch');
  const typeFilter = document.getElementById('alertsTypeFilter');
  const summary = document.getElementById('alertsSummary');
  const alertsList = document.getElementById('alertsEventsList');

  let currentAlerts = [];

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function renderSummary(payload) {
    if (!summary) {
      return;
    }

    const info = payload?.summary || {};
    summary.innerHTML = `
      <article class="mobile-events-kpi">
        <span>Total</span>
        <strong>${Number(info.total || 0)}</strong>
      </article>
      <article class="mobile-events-kpi">
        <span>Activas</span>
        <strong>${Number(info.active || 0)}</strong>
      </article>
      <article class="mobile-events-kpi">
        <span>Inactivas</span>
        <strong>${Number(info.inactive || 0)}</strong>
      </article>
    `;
  }

  function renderAlerts(items) {
    if (!alertsList) {
      return;
    }

    if (!items.length) {
      alertsList.innerHTML = '<div class="mobile-map-empty">No hay alertas para el filtro actual.</div>';
      return;
    }

    alertsList.innerHTML = items.map((item) => {
      const active = Boolean(item?.activo);
      return `
        <article class="mobile-alert-config-card ${active ? 'mobile-alert-config-card--active' : ''}">
          <div class="mobile-alert-config-card__content">
            <strong>${escapeHtml(item?.nombre || 'Alerta')}</strong>
            <small>${escapeHtml(item?.tipo || 'Sin tipo')} | ${Number(item?.dispositivos || 0)} dispositivos</small>
          </div>
          <span class="mobile-alert-config-card__check" aria-label="${active ? 'Activa' : 'Inactiva'}">
            <input type="checkbox" ${active ? 'checked' : ''} disabled />
          </span>
        </article>
      `;
    }).join('');
  }

  function applyFilter() {
    const query = String(searchInput?.value || '').trim().toLowerCase();
    const selectedType = String(typeFilter?.value || 'all').trim();

    const filtered = currentAlerts.filter((item) => {
      const haystack = [
        item?.nombre,
        item?.tipo
      ].filter(Boolean).join(' ').toLowerCase();

      const matchesQuery = !query || haystack.includes(query);
      const matchesState =
        selectedType === 'all' ||
        (selectedType === 'active' && Boolean(item?.activo)) ||
        (selectedType === 'inactive' && !item?.activo);

      return matchesQuery && matchesState;
    });

    renderAlerts(filtered);
  }

  async function loadAlerts() {
    if (!apiClient) {
      return;
    }

    try {
      const session = await appShell?.requireSession?.({
        redirectOnMissing: true
      });

      if (!session) {
        currentAlerts = [];
        renderSummary(null);
        renderAlerts([]);
        return;
      }

      const payload = await apiClient.getAlerts();
      currentAlerts = Array.isArray(payload?.items) ? payload.items : [];
      renderSummary(payload);
      applyFilter();
    } catch (_error) {
      currentAlerts = [];
      renderSummary(null);
      renderAlerts([]);
    }
  }

  backButton?.addEventListener('click', () => {
    window.location.href = './settings.html';
  });

  searchInput?.addEventListener('input', applyFilter);
  typeFilter?.addEventListener('change', applyFilter);
  refreshButton?.addEventListener('click', loadAlerts);

  loadAlerts();
})();
