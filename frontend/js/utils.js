/**
 * Utilidades de seguridad para el frontend (prevención XSS).
 */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url, fallback) {
  const defaultUrl = fallback || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500';
  if (!url) return defaultUrl;
  const trimmed = String(url).trim();
  if (/^https?:\/\//i.test(trimmed)) return escapeHtml(trimmed);
  return defaultUrl;
}