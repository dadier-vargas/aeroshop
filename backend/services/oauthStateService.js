const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/authMiddleware');

/**
 * State firmado (JWT) para prevenir CSRF en callbacks OAuth.
 * No se almacena en sesión: el proveedor devuelve el mismo state en el callback.
 */
class OAuthStateService {
  static getSigningSecret() {
    return (
      process.env.OAUTH_STATE_SECRET ||
      process.env.SESSION_SECRET ||
      JWT_SECRET
    );
  }

  static create(provider) {
    if (!provider) {
      throw new Error('Proveedor requerido para generar state OAuth.');
    }

    const nonce = crypto.randomBytes(16).toString('hex');

    return jwt.sign(
      {
        purpose: 'oauth_csrf',
        provider,
        nonce
      },
      OAuthStateService.getSigningSecret(),
      {
        expiresIn: '15m',
        issuer: 'aeroshop-oauth',
        audience: 'aeroshop-oauth-callback'
      }
    );
  }

  static verify(state, expectedProvider) {
    if (!state || typeof state !== 'string') {
      throw new Error('Parámetro state ausente o inválido.');
    }

    const decoded = jwt.verify(state, OAuthStateService.getSigningSecret(), {
      issuer: 'aeroshop-oauth',
      audience: 'aeroshop-oauth-callback'
    });

    if (decoded.purpose !== 'oauth_csrf') {
      throw new Error('State OAuth con propósito inválido.');
    }

    if (decoded.provider !== expectedProvider) {
      throw new Error('El proveedor del state no coincide con el callback.');
    }

    return decoded;
  }
}

module.exports = OAuthStateService;