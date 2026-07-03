const jwt = require('jsonwebtoken');

const isProduction = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || (isProduction ? null : 'dev-only-jwt-secret-change-me');

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET es obligatorio cuando NODE_ENV=production');
}

// Middleware para verificar que el usuario está autenticado mediante JWT
const protect = (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Obtener el token del encabezado Authorization: Bearer <token>
      token = req.headers.authorization.split(' ')[1];

      // Verificar el token
      const decoded = jwt.verify(token, JWT_SECRET);

      // Agregar los datos del usuario al objeto request
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role
      };

      next();
    } catch (error) {
      console.error('Error al validar JWT:', error.message);
      return res.status(401).json({ error: 'Acceso no autorizado, token inválido o expirado' });
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Acceso no autorizado, no se proporcionó token' });
  }
};

// Middleware para validar que el usuario tiene el rol 'admin'
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ error: 'Acceso denegado, se requieren privilegios de administrador' });
  }
};

module.exports = {
  protect,
  isAdmin,
  JWT_SECRET
};
