const fs = require('fs/promises');
const path = require('path');

const CACHE_FILE_PATH = path.join(__dirname, '..', 'data', 'geocode-cache.json');
const DEFAULT_PROVIDER = 'nominatim';
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const REQUEST_TIMEOUT_MS = 10000;

let cacheLoaded = false;
let cacheMap = new Map();
let writeQueue = Promise.resolve();
const pendingLookups = new Map();

function round5(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return NaN;
  }

  const factor = 1e5;
  const absRounded = Math.floor(Math.abs(numeric) * factor + 0.5) / factor;
  const signed = numeric < 0 ? -absRounded : absRounded;
  return Number(signed.toFixed(5));
}

function buildCoordinateKey(lat, lon) {
  const latRound = round5(lat);
  const lonRound = round5(lon);
  if (!Number.isFinite(latRound) || !Number.isFinite(lonRound)) {
    return null;
  }

  return `${latRound.toFixed(5)},${lonRound.toFixed(5)}`;
}

function normalizeAddressText(raw) {
  if (typeof raw !== 'string') {
    return null;
  }

  let text = raw.trim();
  if (!text || text.toLowerCase() === 'null') {
    return null;
  }

  if (text.startsWith('"') && text.endsWith('"')) {
    try {
      const parsed = JSON.parse(text);
      text = typeof parsed === 'string' ? parsed : text;
    } catch {
      text = text.slice(1, -1);
    }
  }

  text = text.trim();
  return text || null;
}

async function ensureCacheLoaded() {
  if (cacheLoaded) {
    return;
  }

  try {
    const raw = await fs.readFile(CACHE_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.items)) {
      cacheMap = new Map(parsed.items
        .filter((item) => item && typeof item.key === 'string')
        .map((item) => [item.key, item]));
    }
  } catch {
    cacheMap = new Map();
  }

  cacheLoaded = true;
}

function queuePersistCache() {
  writeQueue = writeQueue
    .then(async () => {
      await fs.mkdir(path.dirname(CACHE_FILE_PATH), { recursive: true });
      const payload = {
        version: 1,
        items: [...cacheMap.entries()].map(([key, value]) => ({
          key,
          ...value
        }))
      };
      await fs.writeFile(CACHE_FILE_PATH, JSON.stringify(payload, null, 2), 'utf8');
    })
    .catch(() => {});

  return writeQueue;
}

async function touchCacheEntry(key) {
  const current = cacheMap.get(key);
  if (!current) {
    return;
  }

  cacheMap.set(key, {
    ...current,
    lastHitAt: new Date().toISOString(),
    hitCount: Number(current.hitCount || 0) + 1
  });

  await queuePersistCache();
}

async function resolveFromProvider(lat, lon, signal) {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(lat),
    lon: String(lon),
    addressdetails: '1'
  });

  const response = await fetch(`${NOMINATIM_BASE_URL}/reverse?${params.toString()}`, {
    method: 'GET',
    headers: {
      'User-Agent': 'GpsRastreoBackend/1.0 (soporte tecnico)',
      Accept: 'application/json'
    },
    signal
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  return normalizeAddressText(payload?.display_name ?? null);
}

async function saveResolvedAddress(key, address) {
  const now = new Date().toISOString();
  cacheMap.set(key, {
    address,
    provider: DEFAULT_PROVIDER,
    createdAt: now,
    updatedAt: now,
    lastHitAt: now,
    hitCount: 1
  });
  await queuePersistCache();
}

async function getAddressAsync(lat, lon) {
  await ensureCacheLoaded();

  const key = buildCoordinateKey(lat, lon);
  if (!key) {
    return null;
  }

  const cached = cacheMap.get(key);
  if (cached?.address) {
    const normalized = normalizeAddressText(cached.address);
    if (normalized) {
      await touchCacheEntry(key);
      return normalized;
    }
  }

  if (pendingLookups.has(key)) {
    return pendingLookups.get(key);
  }

  const lookupPromise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const address = await resolveFromProvider(lat, lon, controller.signal);
      if (!address) {
        return null;
      }

      await saveResolvedAddress(key, address);
      return address;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      pendingLookups.delete(key);
    }
  })();

  pendingLookups.set(key, lookupPromise);
  return lookupPromise;
}

async function getCachedAddressAsync(lat, lon) {
  await ensureCacheLoaded();
  const key = buildCoordinateKey(lat, lon);
  if (!key) {
    return null;
  }

  const cached = cacheMap.get(key);
  const normalized = normalizeAddressText(cached?.address || null);
  if (!normalized) {
    return null;
  }

  await touchCacheEntry(key);
  return normalized;
}

function warmAddressAsync(lat, lon) {
  // Fire-and-forget: caller does not await this.
  getAddressAsync(lat, lon).catch(() => null);
}

module.exports = {
  getAddressAsync,
  getCachedAddressAsync,
  warmAddressAsync,
  buildCoordinateKey
};
