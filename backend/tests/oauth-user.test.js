/**
 * Pruebas unitarias — lógica callback OAuth (Apple: email vs solo sub)
 */
const assert = require('assert');
require('../config/env').bootstrapEnv();
process.env.NODE_ENV = 'development';

const { dbQuery } = require('../config/database');
const OAuthUserService = require('../services/oauthUserService');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runOAuthUserTests() {
  // Esperar a que la BD termine de inicializar/migrar
  await sleep(800);

  const suffix = Math.random().toString(36).slice(2, 8);
  const appleSub = `apple-sub-${suffix}`;
  const appleEmail = `apple-user-${suffix}@privaterelay.appleid.com`;

  console.log('[OAuth TEST] Apple — primer login con email...');
  const first = await OAuthUserService.handleAppleCallback({
    email: appleEmail,
    fullName: 'Usuario Apple Test',
    providerId: appleSub,
    avatar: null
  });

  assert.strictEqual(first.isNewUser, true, 'Primer login Apple debe registrar');
  assert.strictEqual(first.user.provider_id, appleSub);
  assert.strictEqual(first.user.email, appleEmail);

  console.log('[OAuth TEST] Apple — segundo login solo con sub (sin email)...');
  const second = await OAuthUserService.handleAppleCallback({
    email: null,
    fullName: null,
    providerId: appleSub,
    avatar: null
  });

  assert.strictEqual(second.isNewUser, false, 'Segundo login Apple debe ser inicio de sesión');
  assert.strictEqual(second.user.id, first.user.id, 'Debe ser el mismo usuario');
  assert.strictEqual(second.user.email, appleEmail, 'Debe conservar el email guardado');

  console.log('[OAuth TEST] Apple — sub desconocido sin email debe fallar...');
  let threw = false;
  try {
    await OAuthUserService.handleAppleCallback({
      email: null,
      providerId: `unknown-sub-${suffix}`,
      fullName: null,
      avatar: null
    });
  } catch (err) {
    threw = true;
    assert.match(err.message, /no envió el correo/i);
  }
  assert.strictEqual(threw, true, 'Sub nuevo sin email no debe crear usuario fantasma');

  console.log('[OAuth TEST] Google — registro e inicio de sesión...');
  const googleSub = `google-sub-${suffix}`;
  const googleEmail = `google-user-${suffix}@gmail.com`;

  const gFirst = await OAuthUserService.handleGoogleCallback({
    email: googleEmail,
    fullName: 'Google User',
    providerId: googleSub,
    avatar: 'https://example.com/avatar.jpg'
  });
  assert.strictEqual(gFirst.isNewUser, true);

  const gSecond = await OAuthUserService.handleGoogleCallback({
    email: googleEmail,
    fullName: 'Google User',
    providerId: googleSub,
    avatar: 'https://example.com/avatar.jpg'
  });
  assert.strictEqual(gSecond.isNewUser, false);
  assert.strictEqual(gSecond.user.id, gFirst.user.id);

  // Limpieza
  await dbQuery.run('DELETE FROM users WHERE email IN (?, ?)', [appleEmail, googleEmail]);

  console.log('[PASS] Pruebas OAuth user callback completadas.');
}

runOAuthUserTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[FAIL] OAuth user tests:', err);
    process.exit(1);
  });