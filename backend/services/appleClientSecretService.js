const jwt = require('jsonwebtoken');

/**
 * Genera dinámicamente el client_secret de Apple (JWT ES256).
 * NUNCA guardar un client_secret estático para Apple — Apple exige JWT firmado con la .p8.
 *
 * passport-apple ya invoca generación similar internamente; este servicio documenta
 * y centraliza la lógica exigida por Apple.
 */
class AppleClientSecretService {
  static getPrivateKey() {
    const raw = (process.env.APPLE_PRIVATE_KEY || '').trim();
    if (!raw) {
      throw new Error('APPLE_PRIVATE_KEY no configurada.');
    }
    return raw.replace(/\\n/g, '\n');
  }

  static isConfigured() {
    return Boolean(
      (process.env.APPLE_CLIENT_ID || '').trim() &&
      (process.env.APPLE_TEAM_ID || '').trim() &&
      (process.env.APPLE_KEY_ID || '').trim() &&
      (process.env.APPLE_PRIVATE_KEY || '').trim()
    );
  }

  /**
   * @param {number} [ttlSeconds=300] — Apple acepta hasta ~6 meses; usamos 5 min por defecto.
   */
  static generate(ttlSeconds = 300) {
    const clientId = (process.env.APPLE_CLIENT_ID || '').trim();
    const teamId = (process.env.APPLE_TEAM_ID || '').trim();
    const keyId = (process.env.APPLE_KEY_ID || '').trim();
    const privateKey = AppleClientSecretService.getPrivateKey();

    if (!clientId || !teamId || !keyId) {
      throw new Error('Faltan APPLE_CLIENT_ID, APPLE_TEAM_ID o APPLE_KEY_ID.');
    }

    const now = Math.floor(Date.now() / 1000);

    return jwt.sign(
      {
        iss: teamId,
        iat: now,
        exp: now + ttlSeconds,
        aud: 'https://appleid.apple.com',
        sub: clientId
      },
      privateKey,
      {
        algorithm: 'ES256',
        keyid: keyId
      }
    );
  }
}

module.exports = AppleClientSecretService;