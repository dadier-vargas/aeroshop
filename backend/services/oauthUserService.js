const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbQuery } = require('../config/database');
const { JWT_SECRET } = require('../middleware/authMiddleware');

function mapUserResponse(user) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    provider: user.auth_provider,
    auth_provider: user.auth_provider,
    provider_id: user.provider_id || null,
    avatar: user.avatar || null
  };
}

/**
 * Registro e inicio de sesión unificados para callbacks OAuth.
 *
 * GOOGLE: siempre trae email + providerId → buscar/crear por providerId o email.
 *
 * APPLE (dos casos):
 *  - Primera vez: JWT incluye `email` (+ nombre opcional) → REGISTRO.
 *  - Siguientes veces: JWT solo trae `sub` → buscar por (apple + providerId) → LOGIN.
 *    Si no existe cuenta con ese sub y no hay email → error (no crear usuario fantasma).
 */
class OAuthUserService {
  static async findOrCreateFromProfile({ provider, email, fullName, providerId, avatar }) {
    if (!provider) {
      throw new Error('Perfil OAuth incompleto: se requiere proveedor.');
    }

    if (provider === 'apple') {
      return OAuthUserService.handleAppleCallback({ email, fullName, providerId, avatar });
    }

    if (provider === 'google') {
      return OAuthUserService.handleGoogleCallback({ email, fullName, providerId, avatar });
    }

    throw new Error(`Proveedor OAuth no soportado: ${provider}`);
  }

  /**
   * Callback Google: email y providerId son obligatorios.
   */
  static async handleGoogleCallback({ email, fullName, providerId, avatar }) {
    const normalizedEmail = OAuthUserService.normalizeEmail(email);
    const normalizedProviderId = OAuthUserService.normalizeProviderId(providerId);

    if (!normalizedEmail) {
      throw new Error('Google no proporcionó un correo electrónico verificado.');
    }
    if (!normalizedProviderId) {
      throw new Error('Google no proporcionó el identificador de usuario.');
    }

    let user = await dbQuery.get(
      'SELECT * FROM users WHERE auth_provider = ? AND provider_id = ?',
      ['google', normalizedProviderId]
    );

    if (!user) {
      user = await dbQuery.get('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
    }

    if (!user) {
      return OAuthUserService.createOAuthUser({
        provider: 'google',
        email: normalizedEmail,
        fullName,
        providerId: normalizedProviderId,
        avatar
      });
    }

    await OAuthUserService.linkOAuthIdentity(user, {
      provider: 'google',
      providerId: normalizedProviderId,
      fullName,
      avatar
    });

    user = await dbQuery.get('SELECT * FROM users WHERE id = ?', [user.id]);
    return OAuthUserService.issueSession(user, false);
  }

  /**
   * Callback Apple: maneja email en primer login y solo sub en logins posteriores.
   */
  static async handleAppleCallback({ email, fullName, providerId, avatar }) {
    const normalizedProviderId = OAuthUserService.normalizeProviderId(providerId);
    const normalizedEmail = OAuthUserService.normalizeEmail(email);

    if (!normalizedProviderId) {
      throw new Error('Apple no proporcionó el identificador de usuario (sub).');
    }

    // Caso B — login recurrente: solo sub, sin email en el JWT
    let user = await dbQuery.get(
      'SELECT * FROM users WHERE auth_provider = ? AND provider_id = ?',
      ['apple', normalizedProviderId]
    );

    if (user) {
      await OAuthUserService.linkOAuthIdentity(user, {
        provider: 'apple',
        providerId: normalizedProviderId,
        fullName,
        avatar
      });
      user = await dbQuery.get('SELECT * FROM users WHERE id = ?', [user.id]);
      return OAuthUserService.issueSession(user, false);
    }

    // Caso A — primer login: Apple debe enviar email en el payload del JWT
    if (!normalizedEmail) {
      throw new Error(
        'Apple no envió el correo en esta sesión. En el primer inicio debes autorizar compartir el email. ' +
        'Si ya te registraste antes, usa el mismo Apple ID.'
      );
    }

    const existingByEmail = await dbQuery.get('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
    if (existingByEmail) {
      await OAuthUserService.linkOAuthIdentity(existingByEmail, {
        provider: 'apple',
        providerId: normalizedProviderId,
        fullName,
        avatar
      });
      const linked = await dbQuery.get('SELECT * FROM users WHERE id = ?', [existingByEmail.id]);
      return OAuthUserService.issueSession(linked, false);
    }

    return OAuthUserService.createOAuthUser({
      provider: 'apple',
      email: normalizedEmail,
      fullName,
      providerId: normalizedProviderId,
      avatar
    });
  }

  static normalizeEmail(email) {
    if (!email || typeof email !== 'string') return null;
    const trimmed = email.trim().toLowerCase();
    return trimmed || null;
  }

  static normalizeProviderId(providerId) {
    if (providerId === undefined || providerId === null) return null;
    const value = String(providerId).trim();
    return value || null;
  }

  static async createOAuthUser({ provider, email, fullName, providerId, avatar }) {
    const dummyPassword = Math.random().toString(36).substring(2);
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dummyPassword, salt);
    const displayName = (fullName || '').trim() || email.split('@')[0];
    const avatarUrl = avatar ? String(avatar).trim() : null;

    const result = await dbQuery.run(
      `INSERT INTO users (email, password_hash, full_name, role, auth_provider, provider_id, avatar)
       VALUES (?, ?, ?, 'client', ?, ?, ?)`,
      [email, passwordHash, displayName, provider, providerId, avatarUrl]
    );

    const user = await dbQuery.get('SELECT * FROM users WHERE id = ?', [result.lastID]);
    return OAuthUserService.issueSession(user, true);
  }

  static async linkOAuthIdentity(user, { provider, providerId, fullName, avatar }) {
    const updates = [];
    const params = [];

    if (user.auth_provider === 'email' || !user.auth_provider) {
      updates.push('auth_provider = ?');
      params.push(provider);
    }

    if (providerId && user.provider_id !== providerId) {
      updates.push('provider_id = ?');
      params.push(providerId);
    }

    const incomingName = (fullName || '').trim();
    if (
      incomingName &&
      incomingName !== 'Usuario Apple' &&
      (user.full_name === 'Usuario Apple' || !user.full_name?.trim())
    ) {
      updates.push('full_name = ?');
      params.push(incomingName);
    }

    const avatarUrl = avatar ? String(avatar).trim() : null;
    if (avatarUrl && avatarUrl !== user.avatar) {
      updates.push('avatar = ?');
      params.push(avatarUrl);
    }

    if (!updates.length) return;

    params.push(user.id);
    await dbQuery.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  static issueSession(user, isNewUser) {
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        provider: user.auth_provider,
        providerId: user.provider_id || null
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return {
      isNewUser,
      token,
      user: mapUserResponse(user)
    };
  }

  static buildSuccessMessage(provider, isNewUser) {
    const label = provider === 'google' ? 'Google' : 'Apple';
    return isNewUser
      ? `Cuenta creada con ${label}. ¡Bienvenido a AeroShop!`
      : `Sesión iniciada con éxito mediante ${label}`;
  }
}

module.exports = OAuthUserService;