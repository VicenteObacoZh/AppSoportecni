(function () {
  const apiClient = window.GpsRastreoApi;
  const appShell = window.GpsRastreoShell;

  const userTitle = document.getElementById('settingsUserTitle');
  const userEmail = document.getElementById('settingsUserEmail');
  const logoutButton = document.getElementById('settingsLogoutButton');
  const clearCacheButton = document.getElementById('settingsClearCacheButton');
  const alertsRow = document.getElementById('settingsAlertsRow');
  const changePasswordRow = document.getElementById('settingsChangePasswordRow');
  const passwordModal = document.getElementById('settingsPasswordModal');
  const passwordModalBackdrop = document.getElementById('settingsPasswordModalBackdrop');
  const currentPasswordInput = document.getElementById('settingsCurrentPassword');
  const newPasswordInput = document.getElementById('settingsNewPassword');
  const confirmPasswordInput = document.getElementById('settingsConfirmPassword');
  const passwordMessage = document.getElementById('settingsPasswordMessage');
  const passwordCancelButton = document.getElementById('settingsPasswordCancel');
  const passwordAcceptButton = document.getElementById('settingsPasswordAccept');

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

  function openPasswordModal() {
    if (!passwordModal) {
      return;
    }

    if (currentPasswordInput) currentPasswordInput.value = '';
    if (newPasswordInput) newPasswordInput.value = '';
    if (confirmPasswordInput) confirmPasswordInput.value = '';
    if (passwordMessage) passwordMessage.textContent = '';
    if (passwordAcceptButton) {
      passwordAcceptButton.disabled = false;
      passwordAcceptButton.textContent = 'Aceptar';
    }

    passwordModal.hidden = false;
    currentPasswordInput?.focus();
  }

  function closePasswordModal() {
    if (passwordModal) {
      passwordModal.hidden = true;
    }
  }

  async function clearMapCache() {
    const localKeys = [
      'gpsrastreo.routeContext',
      'gpsrastreo.selectedEvent',
      'gpsrastreo.selectedDevice'
    ];

    localKeys.forEach((key) => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // no-op
      }
    });

    try {
      if (window.sessionStorage) {
        window.sessionStorage.clear();
      }
    } catch {
      // no-op
    }

    if (window.caches?.keys) {
      try {
        const cacheKeys = await window.caches.keys();
        await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
      } catch {
        // no-op
      }
    }

    if (window.indexedDB?.databases) {
      try {
        const databases = await window.indexedDB.databases();
        await Promise.all(
          databases
            .map((item) => item?.name)
            .filter(Boolean)
            .map((name) => new Promise((resolve) => {
              const request = window.indexedDB.deleteDatabase(name);
              request.onsuccess = () => resolve();
              request.onerror = () => resolve();
              request.onblocked = () => resolve();
            }))
        );
      } catch {
        // no-op
      }
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
    const email = saved?.email || String(session.email || '').trim();
    if (userTitle) {
      userTitle.textContent = email || 'Usuario activo';
    }
    if (userEmail) {
      userEmail.textContent = email || `SessionId: ${session.id}`;
    }
  }

  logoutButton?.addEventListener('click', () => {
    apiClient?.clearOperationalState?.();
    apiClient?.clearSavedCredentials?.();
    apiClient?.markManualLogout?.();
    window.location.href = './login.html';
  });

  clearCacheButton?.addEventListener('click', async () => {
    const original = clearCacheButton.innerHTML;
    clearCacheButton.disabled = true;

    try {
      await clearMapCache();
      clearCacheButton.textContent = 'Listo';
      window.setTimeout(() => {
        clearCacheButton.innerHTML = original;
        clearCacheButton.disabled = false;
      }, 1400);
    } catch {
      clearCacheButton.textContent = 'Error';
      window.setTimeout(() => {
        clearCacheButton.innerHTML = original;
        clearCacheButton.disabled = false;
      }, 1600);
    }
  });

  alertsRow?.addEventListener('click', () => {
    window.location.href = './alerts.html?view=config';
  });

  alertsRow?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      window.location.href = './alerts.html?view=config';
    }
  });

  changePasswordRow?.addEventListener('click', openPasswordModal);
  changePasswordRow?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPasswordModal();
    }
  });

  passwordModalBackdrop?.addEventListener('click', closePasswordModal);
  passwordCancelButton?.addEventListener('click', closePasswordModal);

  passwordAcceptButton?.addEventListener('click', async () => {
    const currentPassword = String(currentPasswordInput?.value || '').trim();
    const newPassword = String(newPasswordInput?.value || '').trim();
    const confirmPassword = String(confirmPasswordInput?.value || '').trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
      if (passwordMessage) {
        passwordMessage.textContent = 'Completa todos los campos.';
      }
      return;
    }

    if (newPassword !== confirmPassword) {
      if (passwordMessage) {
        passwordMessage.textContent = 'La confirmacion no coincide con la nueva contrasena.';
      }
      return;
    }

    if (passwordAcceptButton) {
      passwordAcceptButton.disabled = true;
      passwordAcceptButton.textContent = 'Guardando...';
    }
    if (passwordMessage) {
      passwordMessage.textContent = '';
    }

    try {
      const changeResult = await apiClient?.changePassword?.({
        currentPassword,
        newPassword,
        confirmPassword
      });

      if (!changeResult?.verified) {
        throw new Error('La plataforma no confirmo el cambio real de la clave.');
      }

      if (passwordMessage) {
        passwordMessage.textContent = 'La clave fue actualizada correctamente.';
      }

      window.setTimeout(() => {
        closePasswordModal();
        apiClient?.clearOperationalState?.();
        apiClient?.markManualLogout?.();
        window.location.href = './login.html';
      }, 900);
    } catch (error) {
      if (passwordMessage) {
        passwordMessage.textContent = error?.userMessage || error?.message || 'No se pudo cambiar la contrasena.';
      }
      if (passwordAcceptButton) {
        passwordAcceptButton.disabled = false;
        passwordAcceptButton.textContent = 'Aceptar';
      }
    }
  });

  initSettings();
})();
