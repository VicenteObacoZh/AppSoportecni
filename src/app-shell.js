(function () {
  const apiClient = window.GpsRastreoApi;
  let redirectInProgress = false;

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
      return 'Tu sesión expiró. Vuelve a iniciar sesión para seguir operando.';
    }
    if (normalized === 'session_required') {
      return 'Necesitas iniciar sesión para continuar.';
    }
    if (normalized === 'backend_unavailable') {
      return 'No se pudo conectar con el backend local.';
    }
    if (normalized === 'session_not_found') {
      return 'No se encontró una sesión válida. Inicia sesión nuevamente.';
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
    if (redirectInProgress) {
      return;
    }

    redirectInProgress = true;
    navigate('./login.html', { reason });
  }

  function isLoginPage() {
    return String(window.location.pathname || '').toLowerCase().endsWith('/login.html');
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
        sessionTitleEl.textContent = 'Sin sesión activa';
      }
      if (sessionTextEl) {
        sessionTextEl.textContent = 'Debes iniciar sesión otra vez para continuar.';
      }

      onMissing?.('session_required');
      if (redirectOnMissing) {
        redirectToLogin('session_required');
      }
      return null;
    } catch (error) {
      const isExpired = Boolean(apiClient?.isSessionError?.(error));
      const isNetwork = Boolean(apiClient?.isNetworkError?.(error));
      clearOperationalState();

      if (sessionTitleEl) {
        sessionTitleEl.textContent = isExpired
          ? 'Sesión expirada'
          : (isNetwork ? 'Sin conexión con backend' : 'No fue posible validar la sesión');
      }
      if (sessionTextEl) {
        sessionTextEl.textContent = apiClient?.getUserMessageFromError?.(error) ||
          (isExpired
            ? 'Tu sesión del portal ya no es válida. Vuelve a iniciar sesión.'
            : 'No se pudo validar la sesión con el backend.');
      }

      onMissing?.(isExpired ? 'session_expired' : (isNetwork ? 'backend_unavailable' : 'session_required'), error);
      if (redirectOnMissing) {
        redirectToLogin(isExpired ? 'session_expired' : (isNetwork ? 'backend_unavailable' : 'session_required'));
      }
      return null;
    }
  }

  function attachGlobalAuthWatchers() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return;
    }

    window.addEventListener('gpsrastreo:session-expired', (event) => {
      if (isLoginPage()) {
        return;
      }

      const code = String(event?.detail?.code || '').toUpperCase();
      const reason = code === 'SESSION_REQUIRED'
        ? 'session_required'
        : (code === 'SESSION_NOT_FOUND' ? 'session_not_found' : 'session_expired');
      redirectToLogin(reason);
    });
  }

  window.GpsRastreoShell = {
    navigate,
    redirectToLogin,
    clearOperationalState,
    requireSession,
    readLoginMessageFromUrl
  };

  initBottomNavFocusMode();
  attachGlobalAuthWatchers();
})();
