const config = require('../config');

function getBaseUrl() {
  return config.platformBaseUrl.replace(/\/$/, '');
}

function buildUrl(path = '/') {
  const baseUrl = getBaseUrl();
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

function decodeHtmlEntities(value) {
  return String(value || '').replace(/&#(x?[0-9a-f]+);/gi, (_match, code) => {
    const raw = String(code || '').trim();
    const parsed = raw.toLowerCase().startsWith('x')
      ? Number.parseInt(raw.slice(1), 16)
      : Number.parseInt(raw, 10);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return '';
    }

    try {
      return String.fromCodePoint(parsed);
    } catch {
      return '';
    }
  });
}

function getSetCookieHeaders(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie();
  }

  const single = response.headers.get('set-cookie');
  return single ? [single] : [];
}

function normalizeCookies(setCookieHeaders) {
  return (setCookieHeaders || [])
    .map((item) => String(item || '').split(';')[0].trim())
    .filter(Boolean);
}

function mergeCookies(...cookieLists) {
  return [...new Set(cookieLists.flat().filter(Boolean))];
}

function extractRequestVerificationToken(html) {
  const source = String(html || '');
  const patterns = [
    /<input[^>]*name=["']__RequestVerificationToken["'][^>]*value=["']([^"']+)["'][^>]*>/i,
    /<input[^>]*value=["']([^"']+)["'][^>]*name=["']__RequestVerificationToken["'][^>]*>/i
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function extractReturnUrl(html) {
  const source = String(html || '');
  const patterns = [
    /<input[^>]*name=["']ReturnUrl["'][^>]*value=["']([^"']*)["'][^>]*>/i,
    /<input[^>]*value=["']([^"']*)["'][^>]*name=["']ReturnUrl["'][^>]*>/i
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match) {
      return match[1] || '/';
    }
  }

  return '/';
}

function stripTags(value) {
  return decodeHtmlEntities(String(value || ''))
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractValidationMessages(html) {
  const messages = [];
  const textDangerRegex = /<[^>]*class="[^"]*text-danger[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/gi;
  let match;

  while ((match = textDangerRegex.exec(String(html || ''))) !== null) {
    const text = stripTags(match[1]);
    if (text) {
      messages.push(text);
    }
  }

  return [...new Set(messages)];
}

function looksLikeLoginScreen(html) {
  const source = String(html || '');
  return (
    source.includes('login-form') ||
    source.includes('__RequestVerificationToken') ||
    source.includes('Input.Email') ||
    source.includes('Iniciar sesi') ||
    source.includes('Soportecni GPS')
  );
}

async function fetchPlatform(path = '/', options = {}) {
  const method = options.method || 'GET';
  const response = await fetch(buildUrl(path), {
    method,
    redirect: 'manual',
    headers: {
      'User-Agent': 'GpsRastreo-Backend/0.1',
      ...(options.headers || {})
    },
    body: options.body
  });

  if (!response.ok) {
    throw new Error(`Platform responded with ${response.status}`);
  }

  const text = await response.text();

  return {
    status: response.status,
    text,
    cookies: normalizeCookies(getSetCookieHeaders(response))
  };
}

async function validatePlatformAvailability() {
  const result = await fetchPlatform('/');
  const isLoginScreen =
    result.text.includes('Iniciar sesion') ||
    result.text.includes('Iniciar sesión') ||
    result.text.includes('Soportecni GPS');

  return {
    status: result.status,
    isLoginScreen
  };
}

async function fetchLoginPage() {
  const response = await fetch(buildUrl('/Cuenta/Login'), {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'User-Agent': 'GpsRastreo-Backend/0.1'
    }
  });

  if (!response.ok) {
    throw new Error(`Login page responded with ${response.status}`);
  }

  const html = await response.text();
  const cookies = normalizeCookies(getSetCookieHeaders(response));
  const token = extractRequestVerificationToken(html);
  const returnUrl = extractReturnUrl(html);

  return {
    status: response.status,
    html,
    cookies,
    token,
    returnUrl,
    hasLoginForm: html.includes('<form method="post" class="login-form">')
  };
}

async function submitLogin({ email, password, rememberMe = true, returnUrl = '/', token, cookies = [] }) {
  const form = new URLSearchParams();
  form.set('ReturnUrl', returnUrl || '/');
  form.set('Input.Email', email);
  form.set('Input.Password', password);
  form.set('Input.RememberMe', rememberMe ? 'true' : 'false');
  form.set('__RequestVerificationToken', token);

  const response = await fetch(buildUrl('/Cuenta/Login'), {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'User-Agent': 'GpsRastreo-Backend/0.1',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookies.join('; ')
    },
    body: form.toString()
  });

  const location = response.headers.get('location');
  const responseCookies = normalizeCookies(getSetCookieHeaders(response));
  const mergedCookies = [...new Set([...cookies, ...responseCookies])];
  const html = await response.text();

  return {
    status: response.status,
    location,
    html,
    cookies: mergedCookies,
    validationMessages: extractValidationMessages(html),
    isSuccessRedirect: response.status >= 300 && response.status < 400 && Boolean(location),
    looksLikeLoginScreen: looksLikeLoginScreen(html),
    looksLikeInvalidCredentials:
      response.status === 200 &&
      looksLikeLoginScreen(html) &&
      extractValidationMessages(html).length > 0,
    looksAuthenticated:
      Boolean(location && /dashboard/i.test(location)) ||
      html.includes('/Cuenta/Logout') ||
      html.includes('/Dashboard')
  };
}

async function fetchMonitorCommandContext(cookies = []) {
  const response = await fetch(buildUrl('/Monitoreo/Monitor'), {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'User-Agent': 'GpsRastreo-Backend/0.1',
      Cookie: cookies.join('; ')
    }
  });

  const html = await response.text();
  const location = response.headers.get('location');
  const responseCookies = normalizeCookies(getSetCookieHeaders(response));
  const mergedCookies = mergeCookies(cookies, responseCookies);
  const token = extractRequestVerificationToken(html);
  const isLoginRedirect = response.status >= 300 && response.status < 400 && /\/Cuenta\/Login/i.test(location || '');

  return {
    status: response.status,
    html,
    token,
    cookies: mergedCookies,
    location,
    isLoginScreen: isLoginRedirect || looksLikeLoginScreen(html)
  };
}

async function fetchConfigurationContext(cookies = []) {
  const response = await fetch(buildUrl('/Configuracion'), {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'User-Agent': 'GpsRastreo-Backend/0.1',
      Cookie: cookies.join('; ')
    }
  });

  const html = await response.text();
  const location = response.headers.get('location');
  const responseCookies = normalizeCookies(getSetCookieHeaders(response));
  const mergedCookies = mergeCookies(cookies, responseCookies);
  const token = extractRequestVerificationToken(html);
  const isLoginRedirect = response.status >= 300 && response.status < 400 && /\/Cuenta\/Login/i.test(location || '');

  return {
    status: response.status,
    html,
    token,
    cookies: mergedCookies,
    location,
    isLoginScreen: isLoginRedirect || looksLikeLoginScreen(html)
  };
}

async function fetchChangePasswordContext(cookies = []) {
  const response = await fetch(buildUrl('/Cuenta/CambiarClave'), {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'User-Agent': 'GpsRastreo-Backend/0.1',
      Cookie: cookies.join('; ')
    }
  });

  const html = await response.text();
  const location = response.headers.get('location');
  const responseCookies = normalizeCookies(getSetCookieHeaders(response));
  const mergedCookies = mergeCookies(cookies, responseCookies);
  const token = extractRequestVerificationToken(html);
  const isLoginRedirect = response.status >= 300 && response.status < 400 && /\/Cuenta\/Login/i.test(location || '');

  return {
    status: response.status,
    html,
    token,
    cookies: mergedCookies,
    location,
    isLoginScreen: isLoginRedirect || looksLikeLoginScreen(html)
  };
}

async function submitChangePassword({
  currentPassword,
  newPassword,
  confirmPassword,
  cookies = []
}) {
  const context = await fetchChangePasswordContext(cookies);

  if (!context.token) {
    return {
      ok: false,
      status: context.status,
      cookies: context.cookies,
      isLoginScreen: context.isLoginScreen,
      validationMessages: [],
      responseText: context.html || '',
      code: context.isLoginScreen ? 'SESSION_EXPIRED' : 'CHANGE_PASSWORD_TOKEN_MISSING'
    };
  }

  const form = new URLSearchParams();
  form.set('Input.CurrentPassword', currentPassword);
  form.set('Input.NewPassword', newPassword);
  form.set('Input.ConfirmPassword', confirmPassword);
  form.set('__RequestVerificationToken', context.token);

  const response = await fetch(buildUrl('/Cuenta/CambiarClave'), {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'User-Agent': 'GpsRastreo-Backend/0.1',
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: context.cookies.join('; ')
    },
    body: form.toString()
  });

  const responseText = await response.text();
  const location = response.headers.get('location');
  const responseCookies = normalizeCookies(getSetCookieHeaders(response));
  const mergedCookies = mergeCookies(context.cookies, responseCookies);
  const isLoginRedirect = response.status >= 300 && response.status < 400 && /\/Cuenta\/Login/i.test(location || '');
  const isLoginScreen = isLoginRedirect || looksLikeLoginScreen(responseText);
  const validationMessages = extractValidationMessages(responseText);
  const isSuccessRedirect =
    response.status >= 300 &&
    response.status < 400 &&
    /\/Cuenta\/CambiarClave/i.test(location || '');

  return {
    ok: response.ok || isSuccessRedirect,
    status: response.status,
    location,
    cookies: mergedCookies,
    isLoginScreen,
    isSuccessRedirect,
    validationMessages,
    responseText
  };
}

async function sendMonitorCommand({ deviceId, command, authorizationKey, cookies = [] }) {
  const context = await fetchMonitorCommandContext(cookies);

  if (!context.token) {
    return {
      ok: false,
      status: context.status,
      payload: null,
      responseText: context.html || '',
      cookies: context.cookies,
      code: context.isLoginScreen ? 'SESSION_EXPIRED' : 'MONITOR_TOKEN_MISSING',
      isLoginScreen: context.isLoginScreen
    };
  }

  const response = await fetch(buildUrl('/Monitoreo/Monitor?handler=SendCommand'), {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'User-Agent': 'GpsRastreo-Backend/0.1',
      'Content-Type': 'application/json',
      RequestVerificationToken: context.token,
      Cookie: context.cookies.join('; ')
    },
    body: JSON.stringify({
      deviceId,
      command,
      authorizationKey
    })
  });

  const responseText = await response.text();
  const location = response.headers.get('location');
  const responseCookies = normalizeCookies(getSetCookieHeaders(response));
  const mergedCookies = mergeCookies(context.cookies, responseCookies);
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();

  let payload = null;
  if (contentType.includes('application/json')) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = null;
    }
  } else {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = null;
    }
  }

  const isLoginRedirect = response.status >= 300 && response.status < 400 && /\/Cuenta\/Login/i.test(location || '');
  const isLoginScreen = isLoginRedirect || looksLikeLoginScreen(responseText);

  return {
    ok: response.ok,
    status: response.status,
    location,
    payload,
    responseText,
    cookies: mergedCookies,
    isLoginScreen
  };
}

async function saveMonitorMeta({
  deviceId,
  vehicleName,
  chasisVin = null,
  driverName = null,
  driverPhone = null,
  driverEmail = null,
  odometroInicialKm = null,
  horasMotorInicial = null,
  cookies = []
}) {
  const context = await fetchMonitorCommandContext(cookies);

  if (!context.token) {
    return {
      ok: false,
      status: context.status,
      payload: null,
      responseText: context.html || '',
      cookies: context.cookies,
      code: context.isLoginScreen ? 'SESSION_EXPIRED' : 'MONITOR_TOKEN_MISSING',
      isLoginScreen: context.isLoginScreen
    };
  }

  const response = await fetch(buildUrl('/Monitoreo/Monitor?handler=SaveMeta'), {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'User-Agent': 'GpsRastreo-Backend/0.1',
      'Content-Type': 'application/json',
      RequestVerificationToken: context.token,
      Cookie: context.cookies.join('; ')
    },
    body: JSON.stringify({
      deviceId,
      vehicleName,
      chasisVin,
      driverName,
      driverPhone,
      driverEmail,
      odometroInicialKm,
      horasMotorInicial
    })
  });

  const responseText = await response.text();
  const location = response.headers.get('location');
  const responseCookies = normalizeCookies(getSetCookieHeaders(response));
  const mergedCookies = mergeCookies(context.cookies, responseCookies);
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();

  let payload = null;
  if (contentType.includes('application/json')) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = null;
    }
  } else {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = null;
    }
  }

  const isLoginRedirect = response.status >= 300 && response.status < 400 && /\/Cuenta\/Login/i.test(location || '');
  const isLoginScreen = isLoginRedirect || looksLikeLoginScreen(responseText);

  return {
    ok: response.ok,
    status: response.status,
    location,
    payload,
    responseText,
    cookies: mergedCookies,
    isLoginScreen
  };
}

async function fetchConfigurationDeviceMeta({ deviceId, cookies = [] }) {
  const response = await fetch(buildUrl(`/Configuracion?handler=Meta&deviceId=${encodeURIComponent(String(deviceId))}`), {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'User-Agent': 'GpsRastreo-Backend/0.1',
      Cookie: cookies.join('; ')
    }
  });

  const responseText = await response.text();
  const location = response.headers.get('location');
  const responseCookies = normalizeCookies(getSetCookieHeaders(response));
  const mergedCookies = mergeCookies(cookies, responseCookies);
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();

  let payload = null;
  if (contentType.includes('application/json')) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = null;
    }
  }

  const isLoginRedirect = response.status >= 300 && response.status < 400 && /\/Cuenta\/Login/i.test(location || '');
  const isLoginScreen = isLoginRedirect || looksLikeLoginScreen(responseText);

  return {
    ok: response.ok,
    status: response.status,
    payload,
    responseText,
    location,
    cookies: mergedCookies,
    isLoginScreen
  };
}

async function saveConfigurationDevice({
  payload,
  cookies = []
}) {
  const context = await fetchConfigurationContext(cookies);

  if (!context.token) {
    return {
      ok: false,
      status: context.status,
      payload: null,
      responseText: context.html || '',
      cookies: context.cookies,
      code: context.isLoginScreen ? 'SESSION_EXPIRED' : 'CONFIG_TOKEN_MISSING',
      isLoginScreen: context.isLoginScreen
    };
  }

  const response = await fetch(buildUrl('/Configuracion?handler=Save'), {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'User-Agent': 'GpsRastreo-Backend/0.1',
      'Content-Type': 'application/json',
      RequestVerificationToken: context.token,
      Cookie: context.cookies.join('; ')
    },
    body: JSON.stringify(payload || {})
  });

  const responseText = await response.text();
  const location = response.headers.get('location');
  const responseCookies = normalizeCookies(getSetCookieHeaders(response));
  const mergedCookies = mergeCookies(context.cookies, responseCookies);
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();

  let parsedPayload = null;
  if (contentType.includes('application/json')) {
    try {
      parsedPayload = JSON.parse(responseText);
    } catch {
      parsedPayload = null;
    }
  } else {
    try {
      parsedPayload = JSON.parse(responseText);
    } catch {
      parsedPayload = null;
    }
  }

  const isLoginRedirect = response.status >= 300 && response.status < 400 && /\/Cuenta\/Login/i.test(location || '');
  const isLoginScreen = isLoginRedirect || looksLikeLoginScreen(responseText);

  return {
    ok: response.ok,
    status: response.status,
    location,
    payload: parsedPayload,
    responseText,
    cookies: mergedCookies,
    isLoginScreen
  };
}

module.exports = {
  fetchPlatform,
  validatePlatformAvailability,
  fetchLoginPage,
  submitLogin,
  fetchMonitorCommandContext,
  fetchConfigurationContext,
  fetchChangePasswordContext,
  fetchConfigurationDeviceMeta,
  saveConfigurationDevice,
  submitChangePassword,
  sendMonitorCommand,
  saveMonitorMeta,
  looksLikeLoginScreen
};
