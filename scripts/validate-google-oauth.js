/**
 * Valida que Google OAuth esté configurado en .env
 */
require('../backend/config/env').bootstrapEnv();

const { getOAuthRedirectUris } = require('../backend/config/oauthUrls');
const OAuthService = require('../backend/services/oauthService');

const ok = OAuthService.isGooglePassportConfigured();
const uris = getOAuthRedirectUris();

console.log('--- Validación Google OAuth ---');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✓ configurado' : '✗ falta');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✓ configurado' : '✗ falta');
console.log('Redirect URI esperada:', uris.google);
console.log('OAuth Passport listo:', ok ? 'SÍ' : 'NO');

if (!ok) {
  console.log('\nEjecuta: powershell -File scripts/setup-google-oauth.ps1');
  process.exit(1);
}

console.log('\nTodo listo. Reinicia npm start y prueba /#login');
process.exit(0);