/**
 * Conversión de montos COP (pesos enteros en la app) ↔ unidad mínima de Stripe (centavos).
 * Ej: $120.000 COP → 12.000.000 centavos en la API de Stripe.
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg',
  'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf'
]);

function toStripeAmount(amountInMainUnit, currency = 'cop') {
  const cur = (currency || 'cop').toLowerCase();
  const rounded = Math.round(Number(amountInMainUnit));
  if (!rounded || rounded <= 0) return 0;
  if (ZERO_DECIMAL_CURRENCIES.has(cur)) return rounded;
  return rounded * 100;
}

function fromStripeAmount(stripeAmount, currency = 'cop') {
  const cur = (currency || 'cop').toLowerCase();
  if (ZERO_DECIMAL_CURRENCIES.has(cur)) return stripeAmount;
  return stripeAmount / 100;
}

module.exports = {
  toStripeAmount,
  fromStripeAmount,
  ZERO_DECIMAL_CURRENCIES
};