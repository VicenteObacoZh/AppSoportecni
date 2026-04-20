(function () {
  const apiClient = window.GpsRastreoApi;
  const appShell = window.GpsRastreoShell;
  const userTitle = document.getElementById('settingsUserTitle');
  const userEmail = document.getElementById('settingsUserEmail');
  const logoutButton = document.getElementById('settingsLogoutButton');
  const clearCacheButton = document.getElementById('settingsClearCacheButton');

  function readSavedCredentials() {
    try {
      const raw = window.localStorage.getItem('gpsrastreo.savedCredentials');
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      return {
        email: String(parsed.email || '')
      };
    } catch {
      return null;
    }
  }

  async function initSettings() {
    const session = await appShell?.requireSession?.({
      redirectOnMissing: true
    });
    if (!session) {
      return;
    }

    const saved = readSavedCredentials();
    const email = saved?.email || '';
    if (userTitle) {
      userTitle.textContent = email || 'Usuario activo';
    }
    if (userEmail) {
      userEmail.textContent = email || `SessionId: ${session.id}`;
    }
  }

  logoutButton?.addEventListener('click', () => {
    apiClient?.clearOperationalState?.();
    window.location.href = './login.html';
  });

  clearCacheButton?.addEventListener('click', () => {
    try {
      window.localStorage.removeItem('gpsrastreo.routeContext');
      window.localStorage.removeItem('gpsrastreo.selectedEvent');
      window.localStorage.removeItem('gpsrastreo.selectedDevice');
      clearCacheButton.textContent = 'Listo';
    } catch {
      clearCacheButton.textContent = 'Error';
    }
  });

  initSettings();
})();
