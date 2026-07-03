const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_CLIENT_EMAIL,
  LEGACY_ADMIN_HASH,
  LEGACY_CLIENT_HASH,
  CURRENT_ADMIN_HASH,
  CURRENT_CLIENT_HASH
} = require('./defaultCredentials');

const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.resolve(__dirname, '../db/ecommerce.db');

// Asegurar que el directorio db existe
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Conectar con la base de datos
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al conectar con la base de datos SQLite:', err.message);
  } else {
    console.log('Conexión establecida con la base de datos SQLite en:', dbPath);
  }
});

// Helper para envolver consultas en promesas (haciendo el código más limpio y fácil de leer)
const dbQuery = {
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },
  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },
  exec: (sql) => {
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};

/**
 * Migra contraseñas demo débiles (admin123/client123) a las credenciales actuales.
 */
async function migrateLegacyDefaultCredentials() {
  const adminResult = await dbQuery.run(
    'UPDATE users SET password_hash = ? WHERE email = ? AND password_hash = ?',
    [CURRENT_ADMIN_HASH, DEFAULT_ADMIN_EMAIL, LEGACY_ADMIN_HASH]
  );
  const clientResult = await dbQuery.run(
    'UPDATE users SET password_hash = ? WHERE email = ? AND password_hash = ?',
    [CURRENT_CLIENT_HASH, DEFAULT_CLIENT_EMAIL, LEGACY_CLIENT_HASH]
  );

  if (adminResult.changes > 0 || clientResult.changes > 0) {
    console.log('[SEGURIDAD] Credenciales demo migradas desde contraseñas heredadas.');
  }
}

// Función para inicializar base de datos
async function initializeDatabase() {
  try {
    // Activar soporte para claves foráneas
    await dbQuery.run('PRAGMA foreign_keys = ON;');

    // Ejecutar esquema
    const schemaPath = path.resolve(__dirname, '../db/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    await dbQuery.exec(schemaSql);
    console.log('Esquema de base de datos cargado/verificado.');

    // Migración ligera: añadir columna payment_intent_id si no existe (compatibilidad SQLite)
    try {
      const tableInfo = await dbQuery.all("PRAGMA table_info(orders);");
      const hasPaymentIntentCol = tableInfo.some(col => col.name === 'payment_intent_id');
      if (!hasPaymentIntentCol) {
        await dbQuery.run("ALTER TABLE orders ADD COLUMN payment_intent_id TEXT;");
        console.log('Migración aplicada: columna payment_intent_id añadida a orders.');
      }
    } catch (migErr) {
      console.warn('Nota de migración (puede ser ignorada si ya existe):', migErr.message);
    }

    // Sembrar datos si la tabla categories está vacía
    const catCheck = await dbQuery.get('SELECT COUNT(*) as count FROM categories');
    if (catCheck.count === 0) {
      console.log('Base de datos vacía. Sembrando datos iniciales...');
      const seedPath = path.resolve(__dirname, '../db/seed.sql');
      const seedSql = fs.readFileSync(seedPath, 'utf-8');
      await dbQuery.exec(seedSql);

      const isProduction = process.env.NODE_ENV === 'production';
      const seedDemoUsers = process.env.SEED_DEMO_USERS === 'true';
      const userCheck = await dbQuery.get('SELECT COUNT(*) as count FROM users');

      if (userCheck.count === 0 && (!isProduction || seedDemoUsers)) {
        const usersSeedPath = path.resolve(__dirname, '../db/seed-users.sql');
        const usersSeedSql = fs.readFileSync(usersSeedPath, 'utf-8');
        await dbQuery.exec(usersSeedSql);
        console.log('Usuarios demo sembrados.');
      } else if (userCheck.count === 0 && isProduction) {
        console.warn('[SEGURIDAD] Producción sin usuarios demo. Crea un admin manualmente vía registro o API.');
      }

      console.log('Datos semilla sembrados con éxito.');
    }

    await migrateLegacyDefaultCredentials();
  } catch (error) {
    console.error('Error al inicializar la base de datos:', error);
  }
}

// Inicializar la base de datos
initializeDatabase();

module.exports = {
  db,
  dbQuery
};
