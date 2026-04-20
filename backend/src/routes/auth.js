const express = require('express');
const config = require('../config');
const mockData = require('../data/mockDashboard');
const { fetchLoginPage, submitLogin } = require('../services/platformClient');
const { createSession, getSession, getLatestSession } = require('../services/sessionStore');

const router = express.Router();

router.get('/login-page', async (_req, res) => {
  if (config.mockMode) {
    return res.json({
      ok: true,
      mode: 'mock',
      hasLoginForm: true,
      tokenDetected: true
    });
  }

  try {
    const page = await fetchLoginPage();
    return res.json({
      ok: true,
      mode: 'live',
      status: page.status,
      hasLoginForm: page.hasLoginForm,
      tokenDetected: Boolean(page.token),
      returnUrl: page.returnUrl
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      mode: 'live',
      message: error.message
    });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'Correo y contrasena son obligatorios.'
    });
  }

  if (config.mockMode) {
    const session = createSession({
      mode: 'mock',
      user: mockData.session,
      cookies: []
    });

    return res.json({
      ok: true,
      mode: 'mock',
      user: mockData.session,
      sessionId: session.id,
      expiresAt: session.expiresAt,
      session: {
        id: session.id,
        mode: session.mode,
        expiresAt: session.expiresAt,
        hasCookies: false
      }
    });
  }

  try {
    const loginPage = await fetchLoginPage();

    if (!loginPage.token) {
      return res.status(502).json({
        ok: false,
        mode: 'live',
        code: 'LOGIN_TOKEN_MISSING',
        message: 'No fue posible extraer el token antifalsificacion de la pagina de login.'
      });
    }

    const result = await submitLogin({
      email,
      password,
      rememberMe: true,
      returnUrl: loginPage.returnUrl,
      token: loginPage.token,
      cookies: loginPage.cookies
    });

    if (result.looksLikeInvalidCredentials) {
      return res.status(401).json({
        ok: false,
        mode: 'live',
        code: 'INVALID_CREDENTIALS',
        message: result.validationMessages?.[0] || 'El portal rechazo las credenciales ingresadas.',
        status: result.status,
        validationMessages: result.validationMessages || []
      });
    }

    if (!result.isSuccessRedirect && !result.looksAuthenticated) {
      return res.status(401).json({
        ok: false,
        mode: 'live',
        code: result.looksLikeLoginScreen ? 'LOGIN_REJECTED' : 'LOGIN_UNCONFIRMED',
        message: 'El portal no confirmo una autenticacion valida. Revisa credenciales o flujo de sesion.',
        status: result.status,
        validationMessages: result.validationMessages || []
      });
    }

    if (!Array.isArray(result.cookies) || result.cookies.length === 0) {
      return res.status(502).json({
        ok: false,
        mode: 'live',
        code: 'SESSION_NOT_CREATED',
        message: 'El portal respondio sin cookies utiles. No se pudo crear una sesion reutilizable.'
      });
    }

    const session = createSession({
      mode: 'live',
      cookies: result.cookies,
      location: result.location || '/Dashboard',
      email
    });

    return res.json({
      ok: true,
      mode: 'live',
      sessionId: session.id,
      nextUrl: result.location || '/Dashboard',
      expiresAt: session.expiresAt,
      session: {
        id: session.id,
        mode: session.mode,
        expiresAt: session.expiresAt,
        hasCookies: true
      }
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      mode: 'live',
      code: 'LOGIN_PROXY_ERROR',
      message: error.message
    });
  }
});

router.get('/session/:id', (req, res) => {
  const session = getSession(req.params.id);

  if (!session) {
    return res.status(404).json({
      ok: false,
      message: 'Sesion no encontrada.'
    });
  }

  return res.json({
    ok: true,
    id: session.id,
    mode: session.mode,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    email: session.email || null,
    nextUrl: session.location || null,
    hasCookies: Array.isArray(session.cookies) && session.cookies.length > 0,
    sessionTtlMinutes: config.sessionTtlMinutes
  });
});

router.get('/latest-session', (_req, res) => {
  const session = getLatestSession();

  if (!session) {
    return res.status(404).json({
      ok: false,
      message: 'No hay sesiones registradas en memoria.'
    });
  }

  return res.json({
    ok: true,
    id: session.id,
    mode: session.mode,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    email: session.email || null,
    nextUrl: session.location || null,
    hasCookies: Array.isArray(session.cookies) && session.cookies.length > 0,
    sessionTtlMinutes: config.sessionTtlMinutes
  });
});

module.exports = router;
