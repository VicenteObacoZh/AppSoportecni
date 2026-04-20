(function () {
  const apiClient = window.GpsRastreoApi;

  function getCurrentUrl() {
    try {
      return new URL(window.location.href);
    } catch {
      return null;
    }
  }

  function readReasonMessage(reason) {
    const normalized = String(reason || '').trim().toLowerCase();

    if (normalized === 'session_expired') {
      return 'Tu sesion expiro. Vuelve a iniciar sesion para seguir operando.';
    }
    if (normalized === 'session_required') {
      return 'Necesitas iniciar sesion para continuar.';
    }
    if (normalized === 'backend_unavailable') {
      return 'No se pudo conectar con el backend local.';
    }

    return '';
  }

  function readLoginMessageFromUrl() {
    const url = getCurrentUrl();
    if (!url) {
      return '';
    }

    return readReasonMessage(url.searchParams.get('reason'));
  }

  function navigate(path, params = {}) {
    const url = new URL(path, window.location.href);
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      url.searchParams.set(key, String(value));
    });

    window.location.href = url.toString();
  }

  function redirectToLogin(reason = 'session_required') {
    navigate('./login.html', { reason });
  }

  function initBottomNavFocusMode() {
    const nav = document.querySelector('.mobile-bottom-nav');
    if (!nav) {
      return;
    }

    const items = Array.from(nav.querySelectorAll('.mobile-bottom-nav__item'));
    if (!items.length) {
      return;
    }

    function clearExpanded() {
      items.forEach((item) => item.classList.remove('nav-item--expanded'));
    }

    items.forEach((item) => {
      item.addEventListener('pointerdown', () => {
        clearExpanded();
        item.classList.add('nav-item--expanded');
      });

      item.addEventListener('focus', () => {
        clearExpanded();
        item.classList.add('nav-item--expanded');
      });

      item.addEventListener('blur', () => {
        window.setTimeout(() => {
          if (!nav.contains(document.activeElement)) {
            clearExpanded();
          }
        }, 120);
      });
    });

    document.addEventListener('pointerdown', (event) => {
      if (!nav.contains(event.target)) {
        clearExpanded();
      }
    }, { passive: true });
  }

  function clearOperationalState() {
    apiClient?.clearOperationalState?.();
  }

  async function requireSession(options = {}) {
    const {
      redirectOnMissing = true,
      onMissing,
      sessionTitleEl,
      sessionTextEl
    } = options;

    if (!apiClient) {
      return null;
    }

    try {
      const session = await apiClient.getSessionInfo();
      if (session) {
        return session;
      }

      clearOperationalState();
      if (sessionTitleEl) {
        sessionTitleEl.textContent = 'Sin sesion activa';
      }
      if (sessionTextEl) {
        sessionTextEl.textContent = 'Debes iniciar sesion otra vez para continuar.';
      }

      onMissing?.('session_required');
      if (redirectOnMissing) {
        redirectToLogin('session_required');
      }
      return null;
    } catch (error) {
      const isExpired = String(error?.message || '').includes('SESSION_EXPIRED') || error?.code === 'SESSION_EXPIRED';
      clearOperationalState();

      if (sessionTitleEl) {
        sessionTitleEl.textContent = isExpired ? 'Sesion expirada' : 'No fue posible validar la sesion';
      }
      if (sessionTextEl) {
        sessionTextEl.textContent = isExpired
          ? 'Tu sesion del portal ya no es valida. Vuelve a iniciar sesion.'
          : 'No se pudo validar la sesion con el backend.';
      }

      onMissing?.(isExpired ? 'session_expired' : 'backend_unavailable', error);
      if (redirectOnMissing) {
        redirectToLogin(isExpired ? 'session_expired' : 'backend_unavailable');
      }
      return null;
    }
  }

  window.GpsRastreoShell = {
    navigate,
    redirectToLogin,
    clearOperationalState,
    requireSession,
    readLoginMessageFromUrl
  };

  initBottomNavFocusMode();
})();
