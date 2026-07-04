const AuthController = require('../controllers/authController');
const OAuthStateService = require('../services/oauthStateService');

/**
 * Valida el parámetro `state` en callbacks OAuth (anti-CSRF).
 * Google: req.query.state | Apple (form_post): req.body.state
 */
function validateOAuthState(expectedProvider) {
  return (req, res, next) => {
    const state = req.query?.state || req.body?.state;

    try {
      OAuthStateService.verify(state, expectedProvider);
      return next();
    } catch (error) {
      const message = error.message || 'Estado OAuth inválido (posible CSRF).';
      return AuthController.oauthRedirectError(res, message, expectedProvider);
    }
  };
}

module.exports = {
  validateOAuthState
};