/**
 * Webhook Controller para Stripe
 * 
 * IMPORTANTE para desarrollo local:
 * - Usa el Stripe CLI: stripe login && stripe listen --forward-to http://localhost:5000/api/webhooks/stripe
 * - Copia el whsec_... que te da el CLI a STRIPE_WEBHOOK_SECRET en .env
 * - O usa ngrok para exponer tu localhost y configurar el webhook en el Dashboard de Stripe (test mode).
 * 
 * Este endpoint debe recibir el body RAW (sin parsear) para validar la firma.
 */

const StripeService = require('../services/stripeService');
const { dbQuery } = require('../config/database');
const crypto = require('crypto'); // Para validación manual de firma (sin SDK)

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder';

/**
 * Valida la firma del webhook de Stripe (implementación manual simple).
 * En producción el SDK de Stripe tiene constructEvent que hace esto de forma robusta.
 */
function validateStripeSignature(rawBody, signatureHeader) {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!signatureHeader || !WEBHOOK_SECRET.startsWith('whsec_') || WEBHOOK_SECRET === 'whsec_placeholder') {
    if (isProduction) {
      console.error('[Webhook] Firma o secreto no configurado. Rechazando evento en producción.');
      return false;
    }
    console.warn('[Webhook] Firma o secreto no configurado. Solo permitido en desarrollo.');
    return true;
  }

  try {
    // Stripe firma es t=...,v1=...,v0=...
    const parts = signatureHeader.split(',');
    let timestamp = '';
    let signature = '';

    parts.forEach(part => {
      const [key, val] = part.split('=');
      if (key === 't') timestamp = val;
      if (key === 'v1') signature = val;
    });

    if (!timestamp || !signature) return false;

    // Construir el payload firmado: timestamp + '.' + rawBody
    const payload = `${timestamp}.${rawBody}`;
    const expected = crypto
      .createHmac('sha256', WEBHOOK_SECRET.replace('whsec_', ''))
      .update(payload, 'utf8')
      .digest('hex');

    // Comparación segura contra timing attacks
    const expectedBuf = Buffer.from(expected, 'utf8');
    const receivedBuf = Buffer.from(signature, 'utf8');

    if (expectedBuf.length !== receivedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  } catch (e) {
    console.error('[Webhook] Error validando firma:', e.message);
    return false;
  }
}

/**
 * Maneja eventos de webhook.
 * Actualmente manejamos payment_intent.succeeded y payment_intent.payment_failed.
 */
async function handleStripeWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  // Obtener cuerpo crudo (ya debe venir como string/buffer gracias al middleware raw)
  const rawBody = req.body.toString('utf8');

  // Validar firma
  if (!validateStripeSignature(rawBody, sig)) {
    console.error('[Webhook] Firma de webhook inválida.');
    return res.status(400).send('Firma inválida');
  }

  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    console.error('[Webhook] Error parseando payload:', err);
    return res.status(400).send('Payload inválido');
  }

  console.log(`[Webhook] Evento recibido: ${event.type} | id=${event.id}`);

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        const paymentIntentId = pi.id;
        const metadata = pi.metadata || {};

        console.log(`[Webhook] Pago exitoso PI=${paymentIntentId} monto=${pi.amount}`);

        // Buscar si hay un pedido pendiente asociado por payment_intent_id o metadata
        // (actualmente el flujo principal actualiza en el controlador de orders; esto es respaldo asíncrono)
        let order = await dbQuery.get(
          'SELECT * FROM orders WHERE payment_intent_id = ? OR tracking_number = ?',
          [paymentIntentId, metadata.orderId || '']
        );

        if (order && order.payment_status !== 'completed') {
          await dbQuery.run(
            `UPDATE orders SET status = 'paid', payment_status = 'completed' WHERE id = ?`,
            [order.id]
          );
          console.log(`[Webhook] Pedido #${order.id} actualizado a PAID vía webhook.`);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        const paymentIntentId = pi.id;

        console.log(`[Webhook] Pago fallido PI=${paymentIntentId}`);

        const order = await dbQuery.get('SELECT * FROM orders WHERE payment_intent_id = ?', [paymentIntentId]);
        if (order && order.payment_status !== 'failed') {
          await dbQuery.run(
            `UPDATE orders SET status = 'cancelled', payment_status = 'failed' WHERE id = ?`,
            [order.id]
          );
          console.log(`[Webhook] Pedido #${order.id} marcado como FAILED vía webhook.`);
        }
        break;
      }

      default:
        // Otros eventos (charge.succeeded etc) se pueden agregar
        console.log(`[Webhook] Evento ${event.type} recibido pero no manejado explícitamente.`);
    }

    // Responder 200 rápido a Stripe
    res.json({ received: true });
  } catch (err) {
    console.error('[Webhook] Error procesando evento:', err);
    // Aún respondemos 200 para que Stripe no reintente infinitamente si el error es nuestro
    res.status(200).json({ received: true, warning: 'processed with error logged' });
  }
}

module.exports = { handleStripeWebhook };
