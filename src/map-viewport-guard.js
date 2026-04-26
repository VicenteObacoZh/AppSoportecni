(function () {
  if (!window.L || !window.L.Map) {
    return;
  }

  const LeafletMap = window.L.Map;
  const originalSetView = LeafletMap.prototype.setView;
  const originalFitBounds = LeafletMap.prototype.fitBounds;
  const originalPanInside = LeafletMap.prototype.panInside;

  const FIRST_LOAD_AUTO_VIEW_MS = 4500;
  const PROGRAMMATIC_VIEW_MS = 300;
  const EPS = 0.0000001;

  const AUTO_VIEW_STACK_PATTERNS = [
    'loadMapPage',
    'focusSelectedEvent',
    'enforceSelectedDeviceViewportSafety',
    'keepDeviceMarkerInSafeView'
  ];

  let programmaticUntil = 0;

  function now() {
    return Date.now();
  }

  function markProgrammaticViewportChange() {
    programmaticUntil = now() + PROGRAMMATIC_VIEW_MS;
  }

  function isProgrammaticViewportChange() {
    return now() < programmaticUntil;
  }

  function getStack() {
    try {
      return String(new Error().stack || '');
    } catch {
      return '';
    }
  }

  function comesFromAutoRefreshViewportCode() {
    const stack = getStack();
    return AUTO_VIEW_STACK_PATTERNS.some((pattern) => stack.includes(pattern));
  }

  function rememberViewport(map) {
    if (!map || typeof map.getCenter !== 'function' || typeof map.getZoom !== 'function') {
      return;
    }

    const center = map.getCenter();
    const zoom = Number(map.getZoom());
    const lat = Number(center?.lat);
    const lng = Number(center?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(zoom)) {
      return;
    }

    map.__gpsRastreoLastUserViewport = { lat, lng, zoom };
  }

  function sameViewport(map, viewport) {
    if (!map || !viewport) {
      return false;
    }

    const center = map.getCenter?.();
    const zoom = Number(map.getZoom?.());
    const lat = Number(center?.lat);
    const lng = Number(center?.lng);

    return Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Number.isFinite(zoom) &&
      Math.abs(lat - viewport.lat) <= EPS &&
      Math.abs(lng - viewport.lng) <= EPS &&
      zoom === viewport.zoom;
  }

  function shouldPreserveUserViewport(map) {
    if (!map || !map.__gpsRastreoUserViewportLocked) {
      return false;
    }

    if (now() < Number(map.__gpsRastreoAllowAutoViewportUntil || 0)) {
      return false;
    }

    return comesFromAutoRefreshViewportCode();
  }

  function restoreUserViewport(map) {
    const viewport = map?.__gpsRastreoLastUserViewport;
    if (!map || !viewport) {
      return map;
    }

    if (sameViewport(map, viewport)) {
      return map;
    }

    markProgrammaticViewportChange();
    try {
      return originalSetView.call(map, [viewport.lat, viewport.lng], viewport.zoom, { animate: false });
    } finally {
      window.setTimeout(() => {
        programmaticUntil = 0;
      }, 0);
    }
  }

  LeafletMap.addInitHook(function () {
    const map = this;
    map.__gpsRastreoAllowAutoViewportUntil = now() + FIRST_LOAD_AUTO_VIEW_MS;
    map.__gpsRastreoUserViewportLocked = false;

    const lockFromUserInteraction = () => {
      if (isProgrammaticViewportChange()) {
        return;
      }

      if (now() < Number(map.__gpsRastreoAllowAutoViewportUntil || 0)) {
        return;
      }

      map.__gpsRastreoUserViewportLocked = true;
      window.setTimeout(() => rememberViewport(map), 0);
    };

    map.on('zoomstart movestart dragstart', lockFromUserInteraction);
    map.on('zoomend moveend', () => {
      if (!map.__gpsRastreoUserViewportLocked || isProgrammaticViewportChange()) {
        return;
      }

      rememberViewport(map);
    });
  });

  LeafletMap.prototype.setView = function (center, zoom, options) {
    if (shouldPreserveUserViewport(this)) {
      return restoreUserViewport(this);
    }

    markProgrammaticViewportChange();
    try {
      return originalSetView.call(this, center, zoom, options);
    } finally {
      window.setTimeout(() => {
        programmaticUntil = 0;
      }, 0);
    }
  };

  LeafletMap.prototype.fitBounds = function (bounds, options) {
    if (shouldPreserveUserViewport(this)) {
      return restoreUserViewport(this);
    }

    return originalFitBounds.call(this, bounds, options);
  };

  if (typeof originalPanInside === 'function') {
    LeafletMap.prototype.panInside = function (latlng, options) {
      if (shouldPreserveUserViewport(this)) {
        return this;
      }

      return originalPanInside.call(this, latlng, options);
    };
  }
})();
