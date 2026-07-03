#!/usr/bin/env node
/**
 * Genera o actualiza variables críticas de producción en .env
 * Uso: node scripts/setup-production-env.js [--write]
 */
const fs = require('fs');
const path = require('path');
const {
  generateJwtSecret,
  validateProductionConfig,
  bootstrapEnv,
  applyEnvAliases
} = require('../backend/config/env');

const envPath = path.resolve(__dirname, '../.env');
const shouldWrite = process.argv.includes('--write');

function parseEnv(content) {
  const map = new Map();
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return;
    map.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1).trim());
  });
  return map;
}

function serializeEnv(map, originalContent) {
  const lines = originalContent.split(/\r?\n/);
  const seen = new Set();

  const updated = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return line;
    const key = trimmed.slice(0, eq).trim();
    if (!map.has(key)) return line;
    seen.add(key);
    return `${key}=${map.get(key)}`;
  });

  for (const [key, value] of map.entries()) {
    if (!seen.has(key)) {
      updated.push(`${key}=${value}`);
    }
  }

  return updated.join('\n').replace(/\n?$/, '\n');
}

function main() {
  bootstrapEnv();

  const templatePath = path.resolve(__dirname, '../.env.production.example');
  let content = '';

  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
  } else if (fs.existsSync(templatePath)) {
    content = fs.readFileSync(templatePath, 'utf8');
  } else {
    content = fs.readFileSync(path.resolve(__dirname, '../.env.example'), 'utf8');
  }

  const envMap = parseEnv(content);

  envMap.set('NODE_ENV', 'production');
  if (!envMap.get('HOST')) envMap.set('HOST', '0.0.0.0');
  if (!envMap.get('PORT')) envMap.set('PORT', '5000');
  if (!envMap.get('TRUST_PROXY')) envMap.set('TRUST_PROXY', 'true');
  if (!envMap.get('API_BASE_PATH')) envMap.set('API_BASE_PATH', '/api');

  const currentJwt = envMap.get('JWT_SECRET') || '';
  if (!currentJwt || currentJwt.length < 32 || currentJwt.includes('cambia-este-secreto')) {
    const generated = generateJwtSecret();
    envMap.set('JWT_SECRET', generated);
    console.log('[OK] JWT_SECRET generado automáticamente.');
  }

  if (!envMap.get('PUBLIC_URL')) {
    envMap.set('PUBLIC_URL', 'https://tu-dominio.com');
    console.log('[INFO] Define PUBLIC_URL con tu dominio real.');
  }

  if (!envMap.get('CORS_ORIGINS')) {
    envMap.set('CORS_ORIGINS', envMap.get('PUBLIC_URL'));
  }

  envMap.set('ALLOW_SIMULATED_PAYMENTS', 'false');
  envMap.set('SEED_DEMO_USERS', 'false');

  if (!envMap.get('STRIPE_WEBHOOK_SECRET') || envMap.get('STRIPE_WEBHOOK_SECRET').includes('placeholder')) {
    console.log('[INFO] Configura STRIPE_WEBHOOK_SECRET con el valor de Stripe Dashboard o Stripe CLI.');
  }

  const preview = serializeEnv(envMap, content);
  console.log('\n--- Vista previa de .env de producción ---\n');
  console.log(preview);

  for (const [key, value] of envMap.entries()) {
    process.env[key] = value;
  }
  applyEnvAliases();
  const check = validateProductionConfig();

  console.log('\n--- Validación ---');
  if (check.errors.length) {
    check.errors.forEach((e) => console.error(`[PENDIENTE] ${e}`));
  } else {
    console.log('[OK] Variables críticas presentes.');
  }
  check.warnings.forEach((w) => console.warn(`[AVISO] ${w}`));

  if (shouldWrite) {
    fs.writeFileSync(envPath, preview, 'utf8');
    console.log(`\n[OK] Escrito en ${envPath}`);
  } else {
    console.log('\nEjecuta con --write para guardar los cambios en .env');
  }
}

main();