process.env.MOCK_MODE = 'true';
process.env.SESSION_TTL_MINUTES = '480';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');

let server;
let baseUrl;
let sessionId;

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const payload = await response.json();
  return {
    status: response.status,
    payload
  };
}

test.before(async () => {
  const app = createApp();
  server = await new Promise((resolve) => {
    const nextServer = app.listen(0, '127.0.0.1', () => resolve(nextServer));
  });

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => {
    if (!server) {
      resolve();
      return;
    }

    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});

test('root endpoint exposes backend metadata', async () => {
  const { status, payload } = await requestJson('/');

  assert.equal(status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.mockMode, true);
  assert.equal(payload.sessionTtlMinutes, 480);
});

test('health endpoint reports mock capabilities', async () => {
  const { status, payload } = await requestJson('/api/health');

  assert.equal(status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.mode, 'mock');
  assert.equal(payload.capabilities.login, true);
  assert.equal(payload.capabilities.monitor, true);
  assert.equal(payload.capabilities.alerts, true);
  assert.equal(payload.capabilities.route, true);
});

test('login rejects missing credentials', async () => {
  const { status, payload } = await requestJson('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });

  assert.equal(status, 400);
  assert.equal(payload.ok, false);
});

test('mock login creates a reusable session', async () => {
  const { status, payload } = await requestJson('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'demo@gpsrastreo.test',
      password: 'secret'
    })
  });

  assert.equal(status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.mode, 'mock');
  assert.match(String(payload.sessionId), /^[0-9a-f-]{36}$/i);
  assert.ok(payload.expiresAt);

  sessionId = payload.sessionId;
});

test('session endpoint returns metadata for created mock session', async () => {
  assert.ok(sessionId, 'Expected sessionId from previous login test.');

  const { status, payload } = await requestJson(`/api/auth/session/${sessionId}`);

  assert.equal(status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.id, sessionId);
  assert.equal(payload.mode, 'mock');
  assert.equal(payload.hasCookies, false);
  assert.ok(payload.expiresAt);
});

test('latest-session endpoint resolves the active session', async () => {
  assert.ok(sessionId, 'Expected sessionId from previous login test.');

  const { status, payload } = await requestJson('/api/auth/latest-session');

  assert.equal(status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.id, sessionId);
  assert.equal(payload.mode, 'mock');
});

test('monitor endpoint returns summary data in mock mode', async () => {
  assert.ok(sessionId, 'Expected sessionId from previous login test.');

  const { status, payload } = await requestJson(`/api/live/monitor/data?sessionId=${encodeURIComponent(sessionId)}`);

  assert.equal(status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.mode, 'mock');
  assert.ok(Array.isArray(payload.data.devices));
  assert.ok(payload.data.devices.length > 0);
  assert.ok(payload.data.summary.total >= payload.data.devices.length);
});

test('alerts endpoint returns summary data in mock mode', async () => {
  assert.ok(sessionId, 'Expected sessionId from previous login test.');

  const { status, payload } = await requestJson(`/api/live/alerts/list?sessionId=${encodeURIComponent(sessionId)}`);

  assert.equal(status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.mode, 'mock');
  assert.ok(Array.isArray(payload.data.items));
  assert.equal(typeof payload.data.summary.active, 'number');
});

test('recent events endpoint returns normalized event cards in mock mode', async () => {
  assert.ok(sessionId, 'Expected sessionId from previous login test.');

  const { status, payload } = await requestJson(`/api/live/monitor/events/recent?sessionId=${encodeURIComponent(sessionId)}&limit=5`);

  assert.equal(status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.mode, 'mock');
  assert.ok(Array.isArray(payload.data.items));
  assert.ok(payload.data.items.length > 0);

  const [eventItem] = payload.data.items;
  assert.ok(eventItem.eventId);
  assert.ok(eventItem.deviceId);
  assert.equal(typeof eventItem.vehicleName, 'string');
  assert.equal(typeof eventItem.eventType, 'string');
  assert.equal(typeof eventItem.latitude, 'number');
  assert.equal(typeof eventItem.longitude, 'number');
});

test('geofences endpoint returns normalized shapes in mock mode', async () => {
  assert.ok(sessionId, 'Expected sessionId from previous login test.');

  const { status, payload } = await requestJson(`/api/live/monitor/geofences?sessionId=${encodeURIComponent(sessionId)}`);

  assert.equal(status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.mode, 'mock');
  assert.ok(Array.isArray(payload.data.items));
  assert.ok(payload.data.items.length > 0);
  assert.equal(typeof payload.data.summary.total, 'number');
});

test('live monitor endpoint validates missing sessionId', async () => {
  const { status, payload } = await requestJson('/api/live/monitor/data');

  assert.equal(status, 400);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'SESSION_REQUIRED');
});

test('route endpoint validates required parameters', async () => {
  assert.ok(sessionId, 'Expected sessionId from previous login test.');

  const { status, payload } = await requestJson(`/api/live/monitor/route?sessionId=${encodeURIComponent(sessionId)}`);

  assert.equal(status, 400);
  assert.equal(payload.ok, false);
});

test('route endpoint returns normalized route points in mock mode', async () => {
  assert.ok(sessionId, 'Expected sessionId from previous login test.');

  const query = new URLSearchParams({
    sessionId,
    deviceId: 'device-001',
    from: '2026-04-19T00:00:00.000Z',
    to: '2026-04-19T23:59:59.000Z'
  });

  const { status, payload } = await requestJson(`/api/live/monitor/route?${query.toString()}`);

  assert.equal(status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.mode, 'mock');
  assert.ok(Array.isArray(payload.data.points));
  assert.ok(payload.data.points.length > 0);
  assert.equal(typeof payload.data.summary.total, 'number');
});

test('command endpoint sends mock response with valid session', async () => {
  assert.ok(sessionId, 'Expected sessionId from previous login test.');

  const { status, payload } = await requestJson('/api/live/monitor/command', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId,
      deviceId: 1001,
      command: 'engine_stop',
      authorizationKey: '1234'
    })
  });

  assert.equal(status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.mode, 'mock');
  assert.equal(payload.data.ok, true);
});
