/**
 * PM2 — gestión del proceso en producción
 * Uso: npx pm2 start ecosystem.config.js
 */
module.exports = {
  apps: [
    {
      name: 'aeroshop',
      script: 'backend/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env_production: {
        NODE_ENV: 'production'
      },
      error_file: './logs/aeroshop-error.log',
      out_file: './logs/aeroshop-out.log',
      merge_logs: true,
      time: true
    }
  ]
};