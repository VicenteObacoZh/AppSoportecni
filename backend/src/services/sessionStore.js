const crypto = require('crypto');

const sessions = new Map();
let latestSessionId = null;

function createSession(payload) {
  const id = crypto.randomUUID();
  sessions.set(id, {
    id,
    createdAt: new Date().toISOString(),
    ...payload
  });
  latestSessionId = id;
  return sessions.get(id);
}

function getSession(id) {
  return sessions.get(id) || null;
}

function getLatestSession() {
  return latestSessionId ? getSession(latestSessionId) : null;
}

module.exports = {
  createSession,
  getSession,
  getLatestSession
};
