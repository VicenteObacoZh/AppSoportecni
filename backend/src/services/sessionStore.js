const crypto = require('crypto');
const config = require('../config');

const sessions = new Map();
let latestSessionId = null;

function computeExpirationDate() {
  const ttlMinutes = Number(config.sessionTtlMinutes || 0);
  if (!Number.isFinite(ttlMinutes) || ttlMinutes <= 0) {
    return null;
  }

  return new Date(Date.now() + ttlMinutes * 60 * 1000);
}

function isExpired(session) {
  if (!session?.expiresAt) {
    return false;
  }

  const expiresAt = new Date(session.expiresAt);
  return Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now();
}

function deleteSession(id) {
  sessions.delete(id);
  if (latestSessionId === id) {
    latestSessionId = null;
  }
}

function cleanupExpiredSessions() {
  for (const [id, session] of sessions.entries()) {
    if (isExpired(session)) {
      deleteSession(id);
    }
  }
}

function createSession(payload) {
  cleanupExpiredSessions();
  const expiresAt = computeExpirationDate();
  const id = crypto.randomUUID();
  sessions.set(id, {
    id,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt?.toISOString() || null,
    ...payload
  });
  latestSessionId = id;
  return sessions.get(id);
}

function getSession(id) {
  cleanupExpiredSessions();
  const session = sessions.get(id) || null;
  if (!session) {
    return null;
  }

  if (isExpired(session)) {
    deleteSession(id);
    return null;
  }

  return session;
}

function getLatestSession() {
  cleanupExpiredSessions();
  return latestSessionId ? getSession(latestSessionId) : null;
}

module.exports = {
  createSession,
  getSession,
  getLatestSession,
  deleteSession
};
