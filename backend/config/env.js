const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Carga variables desde .env (sin dependencias externas).
 * Debe ejecutarse antes de importar app.js u otros módulos que lean process.env.
 */
function loadEnvFile() {
  const envPath = path.resolve(__dirname, '../../.env');
  if (!fs.existsSync(envPath)) return false;

  try {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    });
    return true;
  } catch (error) {
    console.warn('[ENV] Error leyendo .env:', error.message);
    return false;
  }
}

function applyEnvAliases() {
  if (!process.env.STRIPE_PUBLISHABLE_KEY && process.env.STRIPE_PUPLISHABLE_KEY) {
    process.env.STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUPLISHABLE_KEY.trim();
  }
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function getConfig() {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: isProduction(),
    port: parseInt(process.env.PORT || '5000', 10),
    host: process.env.HOST || '0.0.0.0',
    publicUrl: (process.env.PUBLIC_URL || '').replace(/\/$/, ''),
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5000')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    trustProxy: process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1',
    jwtSecret: process.env.JWT_SECRET || '',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    allowSimulatedPayments: process.env.ALLOW_SIMULATED_PAYMENTS === 'true',
    seedDemoUsers: process.env.SEED_DEMO_USERS === 'true',
    apiBasePath: process.env.API_BASE_PATH || '/api'
  };
}

function generateJwtSecret() {
  return crypto.randomBytes(48).toString('base64url');
}

/**
 * Valida configuración mínima para producción.
 * @param {{ strict?: boolean }} options
 */
function validateProductionConfig(options = {}) {
  const strict = options.strict !== false;
  const cfg = getConfig();
  const errors = [];
  const warnings = [];

  if (!cfg.isProduction) {
    return { ok: true, errors, warnings, config: cfg };
  }

  if (!cfg.jwtSecret) {
    errors.push('JWT_SECRET es obligatorio en producción.');
  } else if (cfg.jwtSecret.length < 32) {
    errors.push('JWT_SECRET debe tener al menos 32 caracteres.');
  } else if (cfg.jwtSecret.includes('cambia-este-secreto') || cfg.jwtSecret.includes('dev-only')) {
    errors.push('JWT_SECRET usa un valor de ejemplo. Genera uno único.');
  }

  const isStripeTestMode = cfg.stripeSecretKey.startsWith('sk_test_');

  if (!cfg.stripeWebhookSecret || cfg.stripeWebhookSecret === 'whsec_placeholder') {
    if (isStripeTestMode) {
      warnings.push('STRIPE_WEBHOOK_SECRET no configurado. Los webhooks estarán deshabilitados (aceptable en staging con sk_test_).');
    } else {
      errors.push('STRIPE_WEBHOOK_SECRET es obligatorio en producción con claves live.');
    }
  }

  if (!cfg.stripeSecretKey || cfg.stripeSecretKey.includes('placeholder')) {
    errors.push('STRIPE_SECRET_KEY no está configurada correctamente.');
  }

  if (!cfg.stripePublishableKey || cfg.stripePublishableKey.includes('placeholder')) {
    errors.push('STRIPE_PUBLISHABLE_KEY no está configurada correctamente.');
  }

  if (!cfg.publicUrl) {
    warnings.push('PUBLIC_URL no definida. Recomendado para CORS y referencias absolutas.');
  }

  const hasLocalhostCors = cfg.corsOrigins.some((o) => /localhost|127\.0\.0\.1/i.test(o));
  if (hasLocalhostCors) {
    warnings.push('CORS_ORIGINS incluye localhost en producción.');
  }

  if (cfg.allowSimulatedPayments) {
    warnings.push('ALLOW_SIMULATED_PAYMENTS=true habilita pagos simulados en producción.');
  }

  if (cfg.seedDemoUsers) {
    warnings.push('SEED_DEMO_USERS=true creará cuentas demo en producción.');
  }

  const ok = strict ? errors.length === 0 : true;
  return { ok, errors, warnings, config: cfg };
}

function bootstrapEnv() {
  const loaded = loadEnvFile();
  applyEnvAliases();
  if (loaded) {
    console.log('[ENV] Variables cargadas desde .env');
  }
  return getConfig();
}

module.exports = {
  loadEnvFile,
  applyEnvAliases,
  isProduction,
  getConfig,
  generateJwtSecret,
  validateProductionConfig,
  bootstrapEnv
};