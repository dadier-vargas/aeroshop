const express = require('express');
const passport = require('passport');
const AuthController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { validateOAuthState } = require('../middleware/oauthStateMiddleware');
const OAuthService = require('../services/oauthService');
const OAuthStateService = require('../services/oauthStateService');

const router = express.Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.get('/me', protect, AuthController.me);

// Flujo popup / One Tap (SPA envía idToken) — mantiene verificación de token en servidor
router.post('/oauth', AuthController.oauthToken);

function passportAuthenticate(provider) {
  return (req, res, next) => {
    passport.authenticate(provider, { session: false }, (err, user, info) => {
      if (err) {
        return AuthController.oauthRedirectError(res, err.message || 'Error de autenticación.', provider);
      }
      if (!user) {
        const msg = info?.message || 'Autenticación cancelada.';
        return AuthController.oauthRedirectError(res, msg, provider);
      }
      req.user = user;
      return AuthController.handlePassportCallback(provider)(req, res);
    })(req, res, next);
  };
}

// ─── Google OAuth (state firmado anti-CSRF) ───────────────────────────────────
router.get('/google', (req, res, next) => {
  if (!OAuthService.isGooglePassportConfigured()) {
    return res.status(503).json({
      error: 'Google OAuth no configurado. Agrega GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en .env'
    });
  }

  const state = OAuthStateService.create('google');
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    state
  })(req, res, next);
});

router.get(
  '/google/callback',
  validateOAuthState('google'),
  (req, res, next) => {
    if (!OAuthService.isGooglePassportConfigured()) {
      return AuthController.oauthRedirectError(res, 'Google OAuth no configurado.', 'google');
    }
    passportAuthenticate('google')(req, res, next);
  }
);

// ─── Apple OAuth (state firmado anti-CSRF) ────────────────────────────────────
router.get('/apple', (req, res, next) => {
  if (!OAuthService.isApplePassportConfigured()) {
    return res.status(503).json({
      error: 'Apple OAuth no configurado. Revisa APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID y APPLE_PRIVATE_KEY.'
    });
  }

  const state = OAuthStateService.create('apple');
  passport.authenticate('apple', {
    session: false,
    state
  })(req, res, next);
});

const appleCallback = [
  validateOAuthState('apple'),
  (req, res, next) => {
    if (!OAuthService.isApplePassportConfigured()) {
      return AuthController.oauthRedirectError(res, 'Apple OAuth no configurado.', 'apple');
    }
    passportAuthenticate('apple')(req, res, next);
  }
];

router.get('/apple/callback', ...appleCallback);
router.post('/apple/callback', ...appleCallback);

module.exports = router;