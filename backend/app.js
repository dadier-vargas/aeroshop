const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Importar rutas
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const orderRoutes = require('./routes/orderRoutes');
const refundRoutes = require('./routes/refundRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

// Importar manejador de Webhook de Stripe (requiere body crudo)
const { handleStripeWebhook } = require('./controllers/webhookController');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const trustProxy = process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1';

if (trustProxy) {
  app.set('trust proxy', 1);
}

// Cabeceras de seguridad HTTP
const helmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://js.stripe.com'],
      styleSrc: ["'self'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com', "'unsafe-inline'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
      imgSrc: ["'self'", 'https:', 'data:'],
      connectSrc: ["'self'", 'https://api.stripe.com'],
      frameSrc: ['https://js.stripe.com', 'https://hooks.stripe.com']
    }
  },
  crossOriginEmbedderPolicy: false
};

if (isProduction) {
  helmetOptions.hsts = {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  };
}

app.use(helmet(helmetOptions));

// CORS restringido (+ localhost en staging/local)
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const publicUrl = process.env.PUBLIC_URL || '';
const isStagingPlaceholder = publicUrl.includes('tu-dominio.com');
if (!isProduction || isStagingPlaceholder || process.env.ALLOW_LOCALHOST_CORS === 'true') {
  ['http://localhost:5000', 'http://127.0.0.1:5000'].forEach((origin) => {
    if (!allowedOrigins.includes(origin)) allowedOrigins.push(origin);
  });
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origen no permitido por CORS'));
  },
  credentials: true
}));

// Rate limiting en rutas de autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 20 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intenta de nuevo más tarde.' }
});

// === WEBHOOK DE STRIPE: body RAW antes del parser JSON global ===
app.post(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  handleStripeWebhook
);

app.use(express.json({ limit: '100kb' }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Rutas de la API
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/refunds', refundRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);

// Ruta de estado general de la API
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date(),
    service: 'ecommerce-api'
  });
});

// Configuración pública para el frontend (sin secretos)
app.get('/api/config/public', (req, res) => {
  const publishableKey =
    process.env.STRIPE_PUBLISHABLE_KEY ||
    process.env.STRIPE_PUPLISHABLE_KEY ||
    'pk_test_placeholder';

  res.json({
    apiBaseUrl: process.env.API_BASE_PATH || '/api',
    publishableKey: publishableKey.trim(),
    allowOfflineMock: !isProduction,
    environment: isProduction ? 'production' : 'development'
  });
});

// Alias retrocompatible
app.get('/api/config/stripe', (req, res) => {
  const publishableKey =
    process.env.STRIPE_PUBLISHABLE_KEY ||
    process.env.STRIPE_PUPLISHABLE_KEY ||
    'pk_test_placeholder';
  res.json({
    publishableKey: publishableKey.trim()
  });
});

// Middleware de manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error no controlado en la aplicación:', err.stack);
  const payload = { error: 'Ocurrió un error interno en el servidor' };
  if (!isProduction && err.message) {
    payload.message = err.message;
  }
  res.status(err.status || 500).json(payload);
});

module.exports = app;