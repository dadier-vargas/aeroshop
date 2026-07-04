const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const appleJwks = jwksClient({
  jwksUri: 'https://appleid.apple.com/auth/keys',
  cache: true,
  rateLimit: true
});

/**
 * Verificación de tokens OAuth (flujo popup / One Tap en SPA).
 * Complementa las rutas Passport (flujo redirect).
 */
class OAuthService {
  static isGooglePassportConfigured() {
    return Boolean(
      (process.env.GOOGLE_CLIENT_ID || '').trim() &&
      (process.env.GOOGLE_CLIENT_SECRET || '').trim()
    );
  }

  static isGoogleTokenConfigured() {
    return Boolean((process.env.GOOGLE_CLIENT_ID || '').trim());
  }

  static isGoogleConfigured() {
    return OAuthService.isGooglePassportConfigured() || OAuthService.isGoogleTokenConfigured();
  }

  static isApplePassportConfigured() {
    return Boolean(
      (process.env.APPLE_CLIENT_ID || '').trim() &&
      (process.env.APPLE_TEAM_ID || '').trim() &&
      (process.env.APPLE_KEY_ID || '').trim() &&
      (process.env.APPLE_PRIVATE_KEY || '').trim()
    );
  }

  static isAppleTokenConfigured() {
    return Boolean((process.env.APPLE_CLIENT_ID || '').trim());
  }

  static isAppleConfigured() {
    return OAuthService.isApplePassportConfigured() || OAuthService.isAppleTokenConfigured();
  }

  static getPublicProviderConfig() {
    return {
      google: {
        enabled: OAuthService.isGoogleConfigured(),
        passport: OAuthService.isGooglePassportConfigured(),
        token: OAuthService.isGoogleTokenConfigured()
      },
      apple: {
        enabled: OAuthService.isAppleConfigured(),
        passport: OAuthService.isApplePassportConfigured(),
        token: OAuthService.isAppleTokenConfigured()
      }
    };
  }

  static async verifyGoogleToken(idToken) {
    const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
    if (!clientId) {
      throw new Error('Google Sign-In no está configurado. Agrega GOOGLE_CLIENT_ID en las variables de entorno.');
    }

    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new Error('No se pudo obtener el correo de la cuenta de Google.');
    }

    if (payload.email_verified === false) {
      throw new Error('El correo de Google no está verificado.');
    }

    return {
      provider: 'google',
      providerId: payload.sub,
      email: payload.email.toLowerCase(),
      fullName: payload.name || payload.email.split('@')[0],
      avatar: payload.picture || null
    };
  }

  static getAppleSigningKey(header, callback) {
    appleJwks.getSigningKey(header.kid, (err, key) => {
      if (err) return callback(err);
      callback(null, key.getPublicKey());
    });
  }

  static verifyAppleToken(idToken) {
    const clientId = (process.env.APPLE_CLIENT_ID || '').trim();
    if (!clientId) {
      return Promise.reject(new Error('Apple Sign In no está configurado. Agrega APPLE_CLIENT_ID en las variables de entorno.'));
    }

    return new Promise((resolve, reject) => {
      jwt.verify(
        idToken,
        OAuthService.getAppleSigningKey,
        {
          algorithms: ['RS256'],
          issuer: 'https://appleid.apple.com',
          audience: clientId
        },
        (err, decoded) => {
          if (err) return reject(new Error('Token de Apple inválido o expirado.'));
          resolve(decoded);
        }
      );
    });
  }

  static async verifyAppleTokenProfile(idToken, fullNameFromClient) {
    const decoded = await OAuthService.verifyAppleToken(idToken);

    let fullName = null;
    if (fullNameFromClient) {
      if (typeof fullNameFromClient === 'string') {
        fullName = fullNameFromClient.trim() || null;
      } else {
        const parts = [fullNameFromClient.givenName, fullNameFromClient.familyName].filter(Boolean);
        if (parts.length) fullName = parts.join(' ');
      }
    }

    // Primera vez: decoded.email puede venir (real o privaterelay.appleid.com).
    // Logins posteriores: solo decoded.sub — email queda null a propósito.
    const email = decoded.email ? decoded.email.toLowerCase() : null;

    return {
      provider: 'apple',
      providerId: decoded.sub,
      email,
      fullName: fullName || 'Usuario Apple',
      avatar: null
    };
  }

  /**
   * Normaliza el perfil crudo del callback Passport de Apple.
   */
  static buildApplePassportProfile(idToken, profile) {
    const decoded = idToken ? require('jsonwebtoken').decode(idToken) : null;
    const providerId = decoded?.sub || profile?.id || null;

    let fullName = null;
    if (profile?.name) {
      const parts = [profile.name.firstName, profile.name.lastName].filter(Boolean);
      if (parts.length) fullName = parts.join(' ');
    }

    const email = profile?.email || decoded?.email || null;

    return {
      provider: 'apple',
      providerId,
      email: email ? email.toLowerCase() : null,
      fullName: fullName || 'Usuario Apple',
      avatar: null
    };
  }

  /**
   * Normaliza el perfil crudo del callback Passport de Google.
   */
  static buildGooglePassportProfile(profile) {
    const email = profile.emails?.[0]?.value || null;
    const emailVerified = profile.emails?.[0]?.verified !== false;

    if (!emailVerified && email) {
      throw new Error('El correo de Google no está verificado.');
    }

    return {
      provider: 'google',
      providerId: profile.id || null,
      email: email ? email.toLowerCase() : null,
      fullName: profile.displayName || null,
      avatar: profile.photos?.[0]?.value || null
    };
  }
}

module.exports = OAuthService;