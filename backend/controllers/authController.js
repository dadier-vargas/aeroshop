const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbQuery } = require('../config/database');
const { JWT_SECRET } = require('../middleware/authMiddleware');

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

    // Validar formato del correo
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
      // Verificar si el correo ya está registrado
      const existingUser = await dbQuery.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
      if (existingUser) {
        return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
      }

      // Cifrar la contraseña
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // Insertar en la base de datos
      const result = await dbQuery.run(
        `INSERT INTO users (email, password_hash, full_name, role, auth_provider) VALUES (?, ?, ?, 'client', 'email')`,
        [email.toLowerCase(), passwordHash, fullName]
      );

      // Obtener el nuevo usuario creado (sin la contraseña)
      const user = await dbQuery.get('SELECT id, email, full_name, role, auth_provider FROM users WHERE id = ?', [result.lastID]);

      // Generar token JWT
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.status(201).json({
        message: 'Usuario registrado exitosamente',
        token,
        user
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
      // Buscar usuario en base de datos
      const user = await dbQuery.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
      if (!user) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      // Validar si es una cuenta de proveedor OAuth
      if (user.auth_provider !== 'email') {
        return res.status(400).json({
          error: `Esta cuenta está asociada a ${user.auth_provider}. Por favor, inicia sesión con Google o Apple.`
        });
      }

      // Comparar contraseñas
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      // Generar JWT
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.status(200).json({
        message: 'Inicio de sesión exitoso',
        token,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          auth_provider: user.auth_provider
        }
      });
    } catch (error) {
      console.error('Error en el inicio de sesión:', error);
      return res.status(500).json({ error: 'Error del servidor al iniciar sesión' });
    }
  }

  /**
   * Inicio de sesión simulado para Google y Apple OAuth.
   */
  static async oauth(req, res) {
    const oauthDevEnabled = process.env.OAUTH_DEV_ENABLED === 'true';
    const isStripeTestMode = (process.env.STRIPE_SECRET_KEY || '').startsWith('sk_test_');

    if (process.env.NODE_ENV === 'production' && !oauthDevEnabled && !isStripeTestMode) {
      return res.status(503).json({
        error: 'OAuth no está habilitado en producción. Configure verificación de tokens del proveedor.'
      });
    }

    const { provider, email, fullName, providerId } = req.body;

    if (!provider || !email || !fullName) {
      return res.status(400).json({ error: 'Campos provider, email y fullName son obligatorios' });
    }

    if (provider !== 'google' && provider !== 'apple') {
      return res.status(400).json({ error: 'Proveedor OAuth no soportado (solo google o apple)' });
    }

    try {
      // Buscar si el usuario ya existe
      let user = await dbQuery.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);

      if (!user) {
        // Crear el usuario OAuth directamente
        // Asignamos una contraseña dummy aleatoria puesto que iniciará sesión mediante OAuth
        const dummyPassword = Math.random().toString(36).substring(2);
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(dummyPassword, salt);

        const result = await dbQuery.run(
          `INSERT INTO users (email, password_hash, full_name, role, auth_provider) VALUES (?, ?, ?, 'client', ?)`,
          [email.toLowerCase(), passwordHash, fullName, provider]
        );

        user = await dbQuery.get('SELECT * FROM users WHERE id = ?', [result.lastID]);
      } else {
        // Si el usuario existe pero tenía otro proveedor, actualizamos por flexibilidad,
        // o mantenemos el original. En este caso mantenemos y verificamos consistencia.
        if (user.auth_provider !== provider && user.auth_provider === 'email') {
          // Vincular cuenta de correo existente con OAuth por comodidad
          await dbQuery.run('UPDATE users SET auth_provider = ? WHERE id = ?', [provider, user.id]);
          user.auth_provider = provider;
        }
      }

      // Generar JWT
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.status(200).json({
        message: `Sesión iniciada con éxito mediante ${provider}`,
        token,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          auth_provider: user.auth_provider
        }
      });
    } catch (error) {
      console.error('Error en OAuth:', error);
      return res.status(500).json({ error: 'Error del servidor al procesar OAuth' });
    }
  }
}

module.exports = AuthController;
