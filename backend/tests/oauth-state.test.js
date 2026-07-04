const assert = require('assert');
require('../config/env').bootstrapEnv();
process.env.NODE_ENV = 'development';

const OAuthStateService = require('../services/oauthStateService');

const googleState = OAuthStateService.create('google');
OAuthStateService.verify(googleState, 'google');

let rejected = false;
try {
  OAuthStateService.verify(googleState, 'apple');
} catch (err) {
  rejected = true;
  assert.match(err.message, /no coincide/i);
}
assert.strictEqual(rejected, true);

console.log('[PASS] OAuth state CSRF tests OK.');
process.exit(0);