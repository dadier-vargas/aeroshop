/**
 * Credenciales demo para desarrollo local.
 * En producción, cambia estas contraseñas o elimina los usuarios semilla.
 */
const DEFAULT_ADMIN_EMAIL = 'admin@ecommerce.com';
const DEFAULT_CLIENT_EMAIL = 'cliente@ecommerce.com';

const DEFAULT_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'ChgMe!AeroAdmin9';
const DEFAULT_CLIENT_PASSWORD = process.env.SEED_CLIENT_PASSWORD || 'ChgMe!Cliente9';

const LEGACY_ADMIN_HASH = '$2a$10$rWyvRYdlbMwg8fHoJLft9eclsHcYBFGaAniQd.HwExPYCs7ksDele';
const LEGACY_CLIENT_HASH = '$2a$10$XC35Vj4ofYHlMbnrP5FcPORNWOLRwrJsjlhYxOoaVZGokiW6N4ECu';

const CURRENT_ADMIN_HASH = '$2a$10$fo8ZLYXuIAG2pioQLPxYLOfglaxTclBCuLunqjIQuWJsE0MzQwqCS';
const CURRENT_CLIENT_HASH = '$2a$10$Lye31HEbi6jj4Fy0p0UrzOULVMModOsJZwS6afGRZfiOdWL14U46m';

module.exports = {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_CLIENT_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_CLIENT_PASSWORD,
  LEGACY_ADMIN_HASH,
  LEGACY_CLIENT_HASH,
  CURRENT_ADMIN_HASH,
  CURRENT_CLIENT_HASH
};