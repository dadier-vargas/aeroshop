const StripeService = require('../services/stripeService');
const { dbQuery } = require('../config/database');
const {
  validateStripePaymentIntent,
  canAccessPaymentIntent
} = require('../utils/paymentValidation');

/**
 * Controlador de Pagos con Stripe (Sandbox)
 * Proporciona endpoints para:
 * - Crear PaymentIntent
 * - Verificar estado de transacción
 * - Soporte para webhooks (lógica separada)
 */
class PaymentController {
  /**
   * POST /api/payments/create-intent
   * Crea un Payment Intent en Stripe para el monto dado.
   * El frontend usa el client_secret para confirmar el pago con Stripe.js de forma segura.
   */
  static async createPaymentIntent(req, res) {
    const { amount, currency = 'cop', orderPreview } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'El campo "amount" es obligatorio y debe ser un número positivo.' });
    }

    try {
      const metadata = {
        source: 'aeroshop-checkout',
        userId: req.user ? req.user.id : 'guest',
        ...(orderPreview && typeof orderPreview === 'object' ? { orderPreview: JSON.stringify(orderPreview).slice(0, 500) } : {})
      };

      const intent = await StripeService.createPaymentIntent(amount, currency, metadata);

      // Log interno para depuración (nunca loguear client_secret completo en producción real)
      console.log(`[Payment] PaymentIntent creado: ${intent.id} | amount: ${intent.amount} ${intent.currency} | user: ${metadata.userId}`);

      return res.status(200).json({
        success: true,
        paymentIntentId: intent.id,
        clientSecret: intent.client_secret,
        amount: intent.amount,
        currency: intent.currency,
        status: intent.status
      });
    } catch (error) {
      console.error('[PaymentController] Error en createPaymentIntent:', error);
      const formatted = StripeService.formatStripeError(error);
      return res.status(400).json({ error: formatted.message, ...formatted });
    }
  }

  /**
   * GET /api/payments/status/:paymentIntentId
   * Verifica el estado actual de un PaymentIntent (útil para polling o después de redirect).
   */
  static async getPaymentStatus(req, res) {
    const { paymentIntentId } = req.params;

    if (!paymentIntentId || !paymentIntentId.startsWith('pi_')) {
      return res.status(400).json({ error: 'paymentIntentId inválido. Debe comenzar con pi_' });
    }

    try {
      const pi = await StripeService.retrievePaymentIntent(paymentIntentId);

      if (!canAccessPaymentIntent(pi, req.user.id, req.user.role)) {
        return res.status(403).json({ error: 'No autorizado para consultar este pago.' });
      }

      // Intentar vincular con un pedido si existe en metadata
      let linkedOrder = null;
      if (pi.metadata && pi.metadata.orderId) {
        linkedOrder = await dbQuery.get('SELECT id, status, payment_status, final_amount FROM orders WHERE id = ?', [pi.metadata.orderId]);
      }

      return res.status(200).json({
        success: true,
        paymentIntent: {
          id: pi.id,
          status: pi.status,
          amount: pi.amount,
          currency: pi.currency
        },
        linkedOrder: linkedOrder || null
      });
    } catch (error) {
      console.error('[PaymentController] Error verificando estado:', error.message);
      return res.status(404).json({ error: 'No se pudo recuperar el estado del pago. Verifica el ID.' });
    }
  }

  /**
   * POST /api/payments/confirm-order
   * (Opcional) Confirma un pedido después de que el cliente confirma el pago en Stripe.
   * El backend verifica que el PaymentIntent esté en succeeded antes de actualizar el pedido.
   */
  static async confirmOrderAfterPayment(req, res) {
    const userId = req.user.id;
    const { orderId, paymentIntentId } = req.body;

    if (!orderId || !paymentIntentId) {
      return res.status(400).json({ error: 'orderId y paymentIntentId son requeridos.' });
    }

    try {
      // 1. Verificar que el PaymentIntent fue exitoso
      const pi = await StripeService.retrievePaymentIntent(paymentIntentId);

      if (pi.status !== 'succeeded') {
        return res.status(400).json({
          error: `El pago aún no ha sido confirmado. Estado actual: ${pi.status}`,
          paymentStatus: pi.status
        });
      }

      // 2. Buscar el pedido y validar propiedad
      const order = await dbQuery.get('SELECT * FROM orders WHERE id = ?', [orderId]);

      if (!order) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
      }
      if (order.user_id !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'No autorizado para este pedido' });
      }

      const validation = await validateStripePaymentIntent(pi, {
        userId,
        expectedAmount: order.final_amount,
        paymentIntentId
      });
      if (!validation.valid) {
        return res.status(400).json({ error: validation.message });
      }

      // 3. Si ya está pagado, no hacer nada
      if (order.payment_status === 'completed') {
        return res.status(200).json({ message: 'El pedido ya estaba confirmado.', orderId, status: order.status });
      }

      // 4. Actualizar el pedido como pagado + guardar referencia al PI
      await dbQuery.run(
        `UPDATE orders SET status = 'paid', payment_status = 'completed', payment_intent_id = ? WHERE id = ?`,
        [paymentIntentId, orderId]
      );

      console.log(`[Payment] Pedido #${orderId} marcado como PAID tras confirmación de Stripe PI ${paymentIntentId}`);

      return res.status(200).json({
        message: 'Pago verificado y pedido confirmado exitosamente.',
        orderId,
        paymentIntentId,
        status: 'paid'
      });
    } catch (error) {
      console.error('[PaymentController] Error confirmando pedido post-pago:', error);
      return res.status(500).json({ error: 'Error al confirmar el pago con la pasarela.' });
    }
  }
}

module.exports = PaymentController;
