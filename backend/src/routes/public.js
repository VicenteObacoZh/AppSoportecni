const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../config');
const { getShareToken } = require('../services/shareTokenStore');
const { getSession } = require('../services/sessionStore');
const { fetchPlatform } = require('../services/platformClient');

const router = express.Router();

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getPublicBaseUrl(req) {
  if (config.publicBaseUrl) {
    return String(config.publicBaseUrl).replace(/\/+$/, '');
  }

  return `${req.protocol}://${req.get('host')}`;
}

function getApkMetadata() {
  const apkPath = path.resolve(config.apkFilePath);

  if (!fs.existsSync(apkPath)) {
    return null;
  }

  const stats = fs.statSync(apkPath);
  const sizeMb = stats.size / (1024 * 1024);

  return {
    path: apkPath,
    filename: path.basename(apkPath),
    downloadName: config.apkDisplayName || path.basename(apkPath),
    sizeBytes: stats.size,
    sizeLabel: `${sizeMb.toFixed(1)} MB`,
    updatedAt: stats.mtime.toISOString()
  };
}

function buildApkPageHtml(req, meta) {
  const baseUrl = getPublicBaseUrl(req);
  const downloadUrl = `${baseUrl}/apk/download`;
  const title = meta ? 'Descarga directa para Android' : 'APK no disponible por ahora';
  const subtitle = meta
    ? 'Instala la app desde un enlace privado de tu VPS mientras Google Play habilita la cuenta.'
    : 'Aun no hay un APK cargado en el servidor. Sube el archivo y vuelve a intentar.';
  const qrValue = escapeHtml(downloadUrl);
  const safeTitle = escapeHtml(title);
  const safeSubtitle = escapeHtml(subtitle);
  const safeDownloadUrl = escapeHtml(downloadUrl);
  const safeFileName = escapeHtml(meta?.downloadName || 'GpsRastreo.apk');
  const safeSize = escapeHtml(meta?.sizeLabel || '--');
  const safeUpdated = escapeHtml(
    meta
      ? new Date(meta.updatedAt).toLocaleString('es-CO', {
          dateStyle: 'medium',
          timeStyle: 'short'
        })
      : '--'
  );
  const cta = meta
    ? `<a class="apk-button" href="/apk/download">Descargar APK</a>`
    : `<span class="apk-button apk-button--disabled">APK pendiente</span>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <style>
    :root {
      --bg: #f7efe4;
      --panel: rgba(255,255,255,.94);
      --ink: #1f2933;
      --muted: #5f6c7b;
      --line: rgba(18, 52, 86, .12);
      --brand: #0d6e6e;
      --brand-strong: #094b4b;
      --accent: #dc6b2f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(13,110,110,.18), transparent 34%),
        radial-gradient(circle at bottom right, rgba(220,107,47,.18), transparent 28%),
        linear-gradient(160deg, #fffaf4 0%, var(--bg) 100%);
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .apk-shell {
      width: min(960px, 100%);
      display: grid;
      gap: 18px;
      grid-template-columns: 1.1fr .9fr;
    }
    .apk-card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 28px;
      box-shadow: 0 24px 60px rgba(20, 27, 40, .12);
      padding: 28px;
      backdrop-filter: blur(10px);
    }
    .apk-kicker {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(13,110,110,.08);
      color: var(--brand-strong);
      font-size: .84rem;
      font-weight: 700;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    h1 {
      margin: 16px 0 10px;
      font-size: clamp(2rem, 4vw, 3.3rem);
      line-height: 1.02;
    }
    p {
      margin: 0;
      color: var(--muted);
      font-size: 1rem;
      line-height: 1.6;
    }
    .apk-button {
      display: inline-flex;
      margin-top: 22px;
      align-items: center;
      justify-content: center;
      min-width: 220px;
      padding: 14px 18px;
      border-radius: 16px;
      background: linear-gradient(135deg, var(--brand) 0%, #118787 100%);
      color: #fff;
      text-decoration: none;
      font-weight: 700;
      box-shadow: 0 14px 30px rgba(13,110,110,.24);
    }
    .apk-button--disabled {
      background: #c7d1d8;
      box-shadow: none;
      cursor: not-allowed;
    }
    .apk-meta {
      display: grid;
      gap: 12px;
      margin-top: 24px;
    }
    .apk-meta article {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 16px;
      border-radius: 18px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,.7);
    }
    .apk-meta label {
      color: var(--muted);
      font-size: .84rem;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .apk-meta strong {
      text-align: right;
      font-size: .96rem;
    }
    .apk-qr-panel {
      display: grid;
      align-content: center;
      justify-items: center;
      text-align: center;
    }
    .apk-qr-box {
      width: min(100%, 320px);
      aspect-ratio: 1;
      display: grid;
      place-items: center;
      padding: 18px;
      border-radius: 28px;
      background: #fff;
      border: 1px solid var(--line);
      box-shadow: inset 0 0 0 1px rgba(0,0,0,.02);
    }
    #apkQr canvas,
    #apkQr img {
      width: 100% !important;
      height: auto !important;
    }
    .apk-link {
      margin-top: 16px;
      color: var(--muted);
      word-break: break-word;
      font-size: .92rem;
    }
    .apk-note {
      margin-top: 14px;
      padding: 12px 14px;
      border-radius: 16px;
      background: rgba(220,107,47,.08);
      color: #7b4a29;
      font-size: .92rem;
    }
    @media (max-width: 860px) {
      .apk-shell {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <main class="apk-shell">
    <section class="apk-card">
      <span class="apk-kicker">Entrega temporal APK</span>
      <h1>${safeTitle}</h1>
      <p>${safeSubtitle}</p>
      ${cta}
      <div class="apk-meta">
        <article><label>Archivo</label><strong>${safeFileName}</strong></article>
        <article><label>Tamano</label><strong>${safeSize}</strong></article>
        <article><label>Actualizado</label><strong>${safeUpdated}</strong></article>
      </div>
      <div class="apk-note">
        En algunos telefonos Android debes permitir "instalar aplicaciones desconocidas" para completar la instalacion.
      </div>
    </section>
    <aside class="apk-card apk-qr-panel">
      <div class="apk-qr-box">
        <div id="apkQr" aria-label="QR de descarga"></div>
      </div>
      <strong style="margin-top:16px;">Escanea el QR para descargar</strong>
      <p class="apk-link">${safeDownloadUrl}</p>
    </aside>
  </main>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
  <script>
    (() => {
      const target = document.getElementById('apkQr');
      const value = "${qrValue}";
      if (window.QRCode && target && value) {
        new window.QRCode(target, {
          text: value,
          width: 280,
          height: 280,
          colorDark: '#123456',
          colorLight: '#ffffff',
          correctLevel: window.QRCode.CorrectLevel.M
        });
      } else if (target) {
        target.textContent = 'No se pudo generar el QR.';
      }
    })();
  </script>
</body>
</html>`;
}

function pickAddress(item) {
  const candidates = [
    item?.address,
    item?.Address,
    item?.direccion,
    item?.Direccion,
    item?.location,
    item?.Location,
    item?.locationAddress,
    item?.LocationAddress,
    item?.formattedAddress,
    item?.FormattedAddress,
    item?.streetAddress,
    item?.StreetAddress,
    item?.lastAddress,
    item?.LastAddress,
    item?.fullAddress,
    item?.FullAddress
  ];

  const found = candidates.find((value) => String(value || '').trim().length > 0);
  return found ? String(found).trim() : null;
}

function normalizeSharedDevice(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  return {
    deviceId: String(raw?.deviceId ?? raw?.DeviceId ?? ''),
    vehicleName: raw?.vehicleName ?? raw?.VehicleName ?? raw?.name ?? raw?.Name ?? 'Unidad',
    uniqueId: raw?.uniqueId ?? raw?.UniqueId ?? raw?.imei ?? raw?.Imei ?? raw?.IMEI ?? '-',
    lat: Number(raw?.lat ?? raw?.latitude ?? raw?.Lat ?? raw?.Latitude),
    lon: Number(raw?.lon ?? raw?.longitude ?? raw?.Lon ?? raw?.Longitude),
    speedKmh: Number(raw?.speedKmh ?? raw?.speed ?? raw?.SpeedKmh ?? raw?.Speed ?? 0),
    course: Number(raw?.course ?? raw?.Course ?? raw?.heading ?? raw?.Heading ?? 0),
    fixTime: raw?.fixTime ?? raw?.FixTime ?? raw?.deviceTime ?? raw?.DeviceTime ?? null,
    address: pickAddress(raw),
    driverName: raw?.driverName ?? raw?.DriverName ?? null
  };
}

function buildShareViewerHtml(token) {
  const safeToken = String(token || '').replace(/"/g, '&quot;');
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Monitoreo compartido</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    :root {
      --bg: #f4f1ec;
      --ink: #1f2328;
      --panel: rgba(255,255,255,.96);
      --brand: #116466;
      --accent: #d95d39;
      --line: rgba(17,100,102,.18);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Manrope, system-ui, sans-serif;
      background: radial-gradient(circle at top, #d8ebe7 0%, var(--bg) 55%);
      color: var(--ink);
    }
    .share-shell {
      min-height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr auto;
    }
    .share-topbar {
      padding: 18px 18px 10px;
    }
    .share-card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 22px;
      box-shadow: 0 18px 50px rgba(0,0,0,.08);
      padding: 16px;
    }
    .share-card h1 {
      margin: 0 0 4px;
      font-size: 1.1rem;
    }
    .share-card p {
      margin: 0;
      color: #556;
      font-size: .93rem;
    }
    #shareMap {
      width: calc(100% - 24px);
      height: 52vh;
      margin: 0 auto;
      border-radius: 24px;
      overflow: hidden;
      border: 1px solid var(--line);
      box-shadow: 0 20px 50px rgba(0,0,0,.08);
    }
    .share-bottom {
      padding: 12px;
    }
    .share-meta {
      display: grid;
      gap: 10px;
    }
    .share-meta strong {
      display: block;
      font-size: 1rem;
    }
    .share-meta span {
      color: #5a6570;
      font-size: .92rem;
    }
    .share-kpis {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      margin-top: 12px;
    }
    .share-kpis article {
      background: #f8fbfb;
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 10px;
    }
    .share-kpis article label {
      display: block;
      font-size: .78rem;
      color: #667;
      margin-bottom: 6px;
    }
    .share-kpis article strong {
      font-size: 1rem;
    }
    .share-status {
      margin-top: 10px;
      text-align: center;
      color: #556;
      font-size: .9rem;
    }
  </style>
</head>
<body>
  <div class="share-shell">
    <header class="share-topbar">
      <section class="share-card">
        <h1 id="shareTitle">Monitoreo compartido</h1>
        <p id="shareSubtitle">Cargando ubicacion autorizada...</p>
      </section>
    </header>
    <main>
      <div id="shareMap"></div>
    </main>
    <footer class="share-bottom">
      <section class="share-card share-meta">
        <div>
          <strong id="shareDeviceName">Unidad</strong>
          <span id="shareAddress">Obteniendo direccion...</span>
        </div>
        <div class="share-kpis">
          <article><label>Velocidad</label><strong id="shareSpeed">0 kph</strong></article>
          <article><label>Ultima conexion</label><strong id="shareFixTime">--</strong></article>
          <article><label>Conductor</label><strong id="shareDriver">-</strong></article>
        </div>
        <div class="share-status" id="shareStatus">Actualizando...</div>
      </section>
    </footer>
  </div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    (() => {
      const token = "${safeToken}";
      const map = window.L.map('shareMap', { zoomControl: true }).setView([-1.8, -78.1], 6);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      let marker = null;

      function formatDateTime(value) {
        if (!value) return '--';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return '--';
        return parsed.toLocaleString();
      }

      async function refresh() {
        const statusEl = document.getElementById('shareStatus');
        try {
          const response = await fetch('/api/public/share/' + encodeURIComponent(token) + '/status', {
            headers: { Accept: 'application/json' }
          });
          const payload = await response.json();
          if (!response.ok || !payload.ok) {
            statusEl.textContent = payload.message || 'El enlace compartido ya no esta disponible.';
            return;
          }

          const data = payload.data || {};
          const device = data.device || {};
          document.getElementById('shareTitle').textContent = 'Monitoreo compartido';
          document.getElementById('shareSubtitle').textContent = data.expiresAt
            ? 'Disponible hasta ' + formatDateTime(data.expiresAt)
            : 'Enlace activo';
          document.getElementById('shareDeviceName').textContent = device.vehicleName || 'Unidad';
          document.getElementById('shareAddress').textContent = device.address || (device.lat + ', ' + device.lon);
          document.getElementById('shareSpeed').textContent = Math.round(Number(device.speedKmh || 0)) + ' kph';
          document.getElementById('shareFixTime').textContent = formatDateTime(device.fixTime);
          document.getElementById('shareDriver').textContent = device.driverName || '-';
          statusEl.textContent = 'Actualizado ' + new Date().toLocaleTimeString();

          const lat = Number(device.lat);
          const lon = Number(device.lon);
          if (Number.isFinite(lat) && Number.isFinite(lon)) {
            if (!marker) {
              marker = window.L.marker([lat, lon]).addTo(map);
            } else {
              marker.setLatLng([lat, lon]);
            }
            marker.bindPopup(device.vehicleName || 'Unidad');
            map.setView([lat, lon], 16);
          }
        } catch (error) {
          statusEl.textContent = error?.message || 'No se pudo actualizar el monitoreo.';
        }
      }

      refresh();
      window.setInterval(refresh, 30000);
    })();
  </script>
</body>
</html>`;
}

router.get('/share/:token', (req, res) => {
  const token = String(req.params.token || '').trim();
  const entry = getShareToken(token);

  if (!entry) {
    return res.status(404).send('Enlace compartido no disponible o expirado.');
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(buildShareViewerHtml(token));
});

router.get('/apk', (req, res) => {
  const meta = getApkMetadata();

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(buildApkPageHtml(req, meta));
});

router.get('/apk/download', (req, res) => {
  const meta = getApkMetadata();

  if (!meta) {
    return res.status(404).json({
      ok: false,
      message: 'El APK aun no esta disponible en el servidor.'
    });
  }

  return res.download(meta.path, meta.downloadName);
});

router.get('/apk/status', (req, res) => {
  const meta = getApkMetadata();

  if (!meta) {
    return res.status(404).json({
      ok: false,
      message: 'El APK aun no esta disponible en el servidor.'
    });
  }

  return res.json({
    ok: true,
    data: {
      filename: meta.downloadName,
      sizeBytes: meta.sizeBytes,
      sizeLabel: meta.sizeLabel,
      updatedAt: meta.updatedAt,
      downloadUrl: `${getPublicBaseUrl(req)}/apk/download`,
      pageUrl: `${getPublicBaseUrl(req)}/apk`
    }
  });
});

router.get('/share/:token/status', async (req, res) => {
  const token = String(req.params.token || '').trim();
  const entry = getShareToken(token);

  if (!entry) {
    return res.status(404).json({
      ok: false,
      message: 'El enlace compartido expiro o ya no es valido.'
    });
  }

  const session = getSession(entry.sessionId);
  if (!session || !Array.isArray(session.cookies) || !session.cookies.length) {
    return res.status(404).json({
      ok: false,
      message: 'La sesion asociada al monitoreo ya no esta disponible.'
    });
  }

  try {
    const result = await fetchPlatform('/Monitoreo/Monitor?handler=Data', {
      headers: {
        Cookie: session.cookies.join('; ')
      }
    });

    let payload = null;
    try {
      payload = JSON.parse(result.text);
    } catch {
      payload = null;
    }

    const devices = Array.isArray(payload?.devices) ? payload.devices : [];
    const rawDevice = devices.find((item) => String(item?.deviceId ?? item?.DeviceId ?? '') === String(entry.deviceId));
    const device = normalizeSharedDevice(rawDevice);

    if (!device) {
      return res.status(404).json({
        ok: false,
        message: 'La unidad compartida ya no esta visible en el monitor.'
      });
    }

    return res.json({
      ok: true,
      data: {
        token: entry.token,
        deviceId: entry.deviceId,
        deviceName: entry.deviceName || device.vehicleName,
        expiresAt: entry.expiresAt,
        durationMinutes: entry.durationMinutes,
        device
      }
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      message: error?.message || 'No se pudo consultar el monitor compartido.'
    });
  }
});

module.exports = router;
