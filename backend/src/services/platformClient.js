const config = require('../config');

function getBaseUrl() {
  return config.platformBaseUrl.replace(/\/$/, '');
}

function buildUrl(path = '/') {
  const baseUrl = getBaseUrl();
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
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
  return String(value || '')
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
  const response = await fetch(buildUrl(path), {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'User-Agent': 'GpsRastreo-Backend/0.1',
      ...(options.headers || {})
    }
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

module.exports = {
  fetchPlatform,
  validatePlatformAvailability,
  fetchLoginPage,
  submitLogin,
  looksLikeLoginScreen
};
