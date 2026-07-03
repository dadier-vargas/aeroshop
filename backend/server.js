const { bootstrapEnv, validateProductionConfig, getConfig } = require('./config/env');

// Cargar .env ANTES de importar módulos que lean process.env
bootstrapEnv();

const validation = validateProductionConfig();
if (validation.warnings.length) {
  validation.warnings.forEach((msg) => console.warn(`[CONFIG] ${msg}`));
}
if (!validation.ok) {
  validation.errors.forEach((msg) => console.error(`[CONFIG] ${msg}`));
  console.error('[CONFIG] Corrige .env o ejecuta: node scripts/setup-production-env.js');
  process.exit(1);
}

const app = require('./app');
const { db } = require('./config/database');

const { port, host, publicUrl, nodeEnv } = getConfig();

const server = app.listen(port, host, () => {
  const localUrl = `http://localhost:${port}`;
  const publicBase = publicUrl || localUrl;

  console.log('===================================================');
  console.log(` AeroShop — servidor en ${host}:${port}`);
  console.log(` Entorno: ${nodeEnv}`);
  console.log(` URL local: ${localUrl}`);
  if (publicUrl) {
    console.log(` URL pública: ${publicUrl}`);
  }
  console.log(` API: ${publicBase}/api`);
  console.log('===================================================');
});

const shutdown = () => {
  console.log('\nRecibida señal de apagado. Cerrando conexiones...');
  server.close(() => {
    console.log('Servidor HTTP cerrado.');
    db.close((err) => {
      if (err) {
        console.error('Error al cerrar base de datos SQLite:', err.message);
      } else {
        console.log('Conexión con SQLite cerrada exitosamente.');
      }
      process.exit(0);
    });
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);