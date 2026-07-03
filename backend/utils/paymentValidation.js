const { dbQuery } = require('../config/database');
const { toStripeAmount } = require('./stripeAmount');

/**
 * Valida un PaymentIntent de Stripe antes de confirmar un pedido.
 * Comprueba estado, monto, propiedad del usuario y reutilización.
 */
async function validateStripePaymentIntent(pi, { userId, expectedAmount, paymentIntentId }) {
  if (!pi) {
    return { valid: false, message: 'PaymentIntent no encontrado.' };
  }

  if (pi.status !== 'succeeded') {
    return {
      valid: false,
      message: `El PaymentIntent no está en estado succeeded (actual: ${pi.status}).`
    };
  }

  const isMockPi = paymentIntentId && paymentIntentId.startsWith('pi_mock_');
  const allowMock = process.env.NODE_ENV !== 'production';

  if (!isMockPi || !allowMock) {
    const currency = pi.currency || 'cop';
    const expectedStripeAmount = toStripeAmount(expectedAmount, currency);
    if (typeof pi.amount === 'number' && pi.amount !== expectedStripeAmount) {
      return {
        valid: false,
        message: 'El monto del pago no coincide con el total del pedido.'
      };
    }

    const piUserId = pi.metadata && pi.metadata.userId;
    if (piUserId != null && String(piUserId) !== String(userId)) {
      return { valid: false, message: 'El pago no pertenece a este usuario.' };
    }
  }

  const reused = await dbQuery.get(
    `SELECT id FROM orders WHERE payment_intent_id = ? AND payment_status = 'completed'`,
    [paymentIntentId]
  );
  if (reused) {
    return { valid: false, message: 'Este pago ya fue utilizado en otro pedido.' };
  }

  return { valid: true };
}

/**
 * Verifica que el usuario autenticado puede consultar un PaymentIntent.
 */
function canAccessPaymentIntent(pi, userId, userRole) {
  if (userRole === 'admin') return true;
  const piUserId = pi.metadata && pi.metadata.userId;
  if (piUserId == null) return false;
  return String(piUserId) === String(userId);
}

module.exports = {
  validateStripePaymentIntent,
  canAccessPaymentIntent
};