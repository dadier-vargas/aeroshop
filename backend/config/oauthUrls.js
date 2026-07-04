/**
 * URLs OAuth centralizadas — deben coincidir EXACTAMENTE con Google Cloud y Apple Developer.
 * Todas leen process.env; nunca hardcodear credenciales ni hosts de producción aquí.
 */
function getOAuthBaseUrl() {
  const base =
    process.env.OAUTH_CALLBACK_BASE_URL ||
    process.env.PUBLIC_URL ||
    `http://localhost:${process.env.PORT || 5000}`;
  return base.replace(/\/$/, '');
}

function getOAuthRedirectUris() {
  const base = getOAuthBaseUrl();
  return {
    google: `${base}/auth/google/callback`,
    apple: `${base}/auth/apple/callback`
  };
}

module.exports = {
  getOAuthBaseUrl,
  getOAuthRedirectUris
};