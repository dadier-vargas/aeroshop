#!/usr/bin/env node
const { bootstrapEnv, validateProductionConfig } = require('../backend/config/env');

process.env.NODE_ENV = process.env.NODE_ENV || 'production';
bootstrapEnv();

const result = validateProductionConfig();
result.warnings.forEach((w) => console.warn(`[AVISO] ${w}`));

if (!result.ok) {
  result.errors.forEach((e) => console.error(`[ERROR] ${e}`));
  process.exit(1);
}

console.log('[OK] Configuración de producción válida.');
process.exit(0);