const crypto = require('crypto');

const shareTokens = new Map();

function nowMs() {
  return Date.now();
}

function cleanupExpiredShareTokens() {
  for (const [token, item] of shareTokens.entries()) {
    const expiresAtMs = new Date(item?.expiresAt || 0).getTime();
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs()) {
      shareTokens.delete(token);
    }
  }
}

function createShareToken(payload = {}) {
  cleanupExpiredShareTokens();

  const durationMinutes = Number(payload.durationMinutes || 0);
  const expiresAt = new Date(nowMs() + Math.max(1, durationMinutes) * 60 * 1000).toISOString();
  const token = crypto.randomBytes(24).toString('hex');

  const entry = {
    token,
    createdAt: new Date().toISOString(),
    expiresAt,
    sessionId: payload.sessionId || null,
    deviceId: String(payload.deviceId || '').trim(),
    deviceName: payload.deviceName || null,
    durationMinutes: Math.max(1, durationMinutes)
  };

  shareTokens.set(token, entry);
  return entry;
}

function getShareToken(token) {
  cleanupExpiredShareTokens();
  const entry = shareTokens.get(String(token || '').trim()) || null;
  if (!entry) {
    return null;
  }

  const expiresAtMs = new Date(entry.expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs()) {
    shareTokens.delete(entry.token);
    return null;
  }

  return entry;
}

function revokeShareToken(token) {
  shareTokens.delete(String(token || '').trim());
}

module.exports = {
  createShareToken,
  getShareToken,
  revokeShareToken,
  cleanupExpiredShareTokens
};
