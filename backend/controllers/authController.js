const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbQuery } = require('../config/database');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const OAuthService = require('../services/oauthService');
const OAuthUserService = require('../services/oauthUserService');
const { getOAuthCallbackBaseUrl } = require('../config/passport');

function getFrontendBaseUrl() {
  const base =
    process.env.FRONTEND_URL ||
    process.env.PUBLIC_URL ||
    getOAuthCallbackBaseUrl();
  return base.replace(/\/$/, '');
}

/**
 * Controlador de Autenticación
 */
class AuthController {
  /**
   * Registro de un nuevo cliente.
   */
  static async register(req, res) {
    const { email, password, fullName } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios: email, password, fullName' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'El formato de correo electrónico no es válido' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(password)) {
      return res.status(400).json({ error: 'La contraseña debe incluir al menos una letra y un número' });
    }

    try {
      const existingUser = await dbQuery.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
      if (existingUser) {
        return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const result = await dbQuery.run(
        `INSERT INTO users (email, password_hash, full_name, role, auth_provider) VALUES (?, ?, ?, 'client', 'email')`,
        [email.toLowerCase(), passwordHash, fullName]
      );

      const user = await dbQuery.get(
        'SELECT id, email, full_name, role, auth_provider, provider_id, avatar FROM users WHERE id = ?',
        [result.lastID]
      );

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.status(201).json({
        message: 'Usuario registrado exitosamente',
        token,
        user: AuthController.formatUser(user)
      });
    } catch (error) {
      console.error('Error al registrar usuario:', error);
      return res.status(500).json({ error: 'Error del servidor al registrar el usuario' });
    }
  }

  /**
   * Inicio de sesión de usuarios.
   */
  static async login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
    }

    try {
      const user = await dbQuery.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
      if (!user) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      if (user.auth_provider !== 'email') {
        return res.status(400).json({
          error: `Esta cuenta está asociada a ${user.auth_provider}. Por favor, inicia sesión con Google o Apple.`
        });
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.status(200).json({
        message: 'Inicio de sesión exitoso',
        token,
        user: AuthController.formatUser(user)
      });
    } catch (error) {
      console.error('Error en el inicio de sesión:', error);
      return res.status(500).json({ error: 'Error del servidor al iniciar sesión' });
    }
  }

  static formatUser(user) {
    if (!user) return null;
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
   * Perfil del usuario autenticado (usado tras callback OAuth).
   */
  static async me(req, res) {
    try {
      const user = await dbQuery.get(
        'SELECT id, email, full_name, role, auth_provider, provider_id, avatar FROM users WHERE id = ?',
        [req.user.id]
      );
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      return res.status(200).json({ user: AuthController.formatUser(user) });
    } catch (error) {
      console.error('Error en /auth/me:', error);
      return res.status(500).json({ error: 'Error del servidor' });
    }
  }

  /**
   * Flujo popup / One Tap: el frontend envía idToken verificado en servidor.
   */
  static async oauthToken(req, res) {
    const { provider, idToken, fullName: fullNameFromClient } = req.body;

    if (!provider) {
      return res.status(400).json({ error: 'El campo provider es obligatorio' });
    }

    if (provider !== 'google' && provider !== 'apple') {
      return res.status(400).json({ error: 'Proveedor OAuth no soportado (solo google o apple)' });
    }

    if (!idToken) {
      return res.status(400).json({
        error: provider === 'google'
          ? 'Inicia sesión con tu cuenta de Google desde el botón oficial.'
          : 'Inicia sesión con tu cuenta de Apple desde el botón oficial.'
      });
    }

    try {
      let profile;

      if (provider === 'google') {
        if (!OAuthService.isGoogleTokenConfigured()) {
          return res.status(503).json({ error: 'Google Sign-In no está configurado en el servidor.' });
        }
        profile = await OAuthService.verifyGoogleToken(idToken);
      } else {
        if (!OAuthService.isAppleTokenConfigured()) {
          return res.status(503).json({ error: 'Apple Sign In no está configurado en el servidor.' });
        }
        profile = await OAuthService.verifyAppleTokenProfile(idToken, fullNameFromClient);
      }

      const result = await OAuthUserService.findOrCreateFromProfile(profile);

      return res.status(result.isNewUser ? 201 : 200).json({
        message: OAuthUserService.buildSuccessMessage(provider, result.isNewUser),
        token: result.token,
        user: result.user,
        isNewUser: result.isNewUser
      });
    } catch (error) {
      console.error('Error en OAuth token:', error);
      const message = error.message || 'Error del servidor al procesar OAuth';
      const status = /no está configurado|inválido|expirado|verificado|proporcionó/i.test(message) ? 401 : 500;
      return res.status(status).json({ error: message });
    }
  }

  /**
   * Callback Passport: redirige al frontend con JWT.
   */
  static oauthRedirectSuccess(res, authResult) {
    const frontendBase = getFrontendBaseUrl();
    const params = new URLSearchParams({
      token: authResult.token,
      provider: authResult.provider || authResult.user.auth_provider,
      new: authResult.isNewUser ? '1' : '0'
    });

    return res.redirect(`${frontendBase}/#oauth/callback?${params.toString()}`);
  }

  static oauthRedirectError(res, message, provider = 'oauth') {
    const frontendBase = getFrontendBaseUrl();
    const params = new URLSearchParams({
      error: message || 'No se pudo completar la autenticación.',
      provider
    });
    return res.redirect(`${frontendBase}/#oauth/callback?${params.toString()}`);
  }

  static handlePassportCallback(provider) {
    return (req, res) => {
      const authResult = req.user;
      if (!authResult || !authResult.token) {
        return AuthController.oauthRedirectError(res, 'Autenticación cancelada o fallida.', provider);
      }
      return AuthController.oauthRedirectSuccess(res, { ...authResult, provider });
    };
  }
}

module.exports = AuthController;