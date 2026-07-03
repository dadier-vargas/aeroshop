/**
 * Servicio de Integración con Stripe (MODO SANDBOX / TEST)
 * Implementa Payment Intents API usando llamadas directas a la API REST de Stripe.
 * Esto evita dependencias adicionales y es 100% compatible con Node.js.
 * 
 * Usa SIEMPRE claves de prueba (sk_test_...).
 * Documentación: https://stripe.com/docs/api/payment_intents
 */

const { toStripeAmount, fromStripeAmount } = require('../utils/stripeAmount');

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
const STRIPE_API_BASE = 'https://api.stripe.com/v1';

const isMockMode = !STRIPE_SECRET_KEY || STRIPE_SECRET_KEY.includes('placeholder') || STRIPE_SECRET_KEY === 'sk_test_placeholder';

const isProduction = process.env.NODE_ENV === 'production';

if (!isMockMode && isProduction && STRIPE_SECRET_KEY.startsWith('sk_test_')) {
  console.error('⚠️  ERROR: STRIPE_SECRET_KEY es de PRUEBA (sk_test_) en producción. Usa sk_live_.');
}

if (!isMockMode && !isProduction && !STRIPE_SECRET_KEY.startsWith('sk_test_')) {
  console.warn('⚠️  ADVERTENCIA: STRIPE_SECRET_KEY no parece una clave de PRUEBA. Usa solo sk_test_* en desarrollo.');
}

if (isMockMode) {
  console.log('ℹ️  StripeService: MODO SIMULACIÓN ACTIVO (claves placeholder). Usa tarjetas de prueba para flujo completo sin llamadas reales.');
}

/**
 * Helper para llamadas a la API de Stripe con autenticación.
 */
async function stripeRequest(method, path, body = null) {
  const url = `${STRIPE_API_BASE}${path}`;
  const auth = Buffer.from(`${STRIPE_SECRET_KEY}:`).toString('base64');

  const options = {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': '2024-06-20' // Versión estable recomendada
    }
  };

  if (body) {
    // Convertir objeto a form-urlencoded (Stripe requiere esto para muchos endpoints)
    const params = new URLSearchParams();
    Object.entries(body).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        if (typeof value === 'object') {
          // Para nested como metadata[foo]=bar
          Object.entries(value).forEach(([subKey, subVal]) => {
            params.append(`${key}[${subKey}]`, subVal);
          });
        } else {
          params.append(key, value);
        }
      }
    });
    options.body = params.toString();
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    const err = new Error(data.error?.message || 'Error en la API de Stripe');
    err.type = data.error?.type || 'api_error';
    err.code = data.error?.code || 'unknown';
    err.status = response.status;
    err.raw = data;
    throw err;
  }

  return data;
}

/**
 * Crea un PaymentIntent para iniciar un pago.
 * @param {number} amount - Monto en la menor unidad (ej: 120000 para COP $1200.00). Stripe usa centavos.
 * @param {string} currency - 'cop' para Colombia
 * @param {object} metadata - Datos adicionales (orderId, userId, etc.)
 * @returns {Promise<object>} PaymentIntent con client_secret
 */
async function createPaymentIntent(amount, currency = 'cop', metadata = {}) {
  if (!amount || amount <= 0) {
    throw new Error('El monto debe ser mayor a cero.');
  }

  const amountInSmallestUnit = toStripeAmount(amount, currency);

  // ============================================================
  // MODO SIMULACIÓN (para .env de ejemplo / desarrollo sin claves reales)
  // ============================================================
  if (isMockMode) {
    const fakeId = 'pi_mock_' + Math.random().toString(36).substring(2, 18);
    const fakeSecret = fakeId + '_secret_' + Math.random().toString(36).substring(2, 12);

    // Simular latencia de red
    await new Promise(r => setTimeout(r, 180));

    console.log(`[Stripe MOCK] PaymentIntent creado: ${fakeId} | $${amount} COP`);

    return {
      id: fakeId,
      client_secret: fakeSecret,
      amount: amountInSmallestUnit,
      amountMain: Math.round(amount),
      currency: currency.toLowerCase(),
      status: 'requires_payment_method',
      metadata: { ...metadata, amountMain: String(Math.round(amount)) }
    };
  }

  // ============================================================
  // MODO REAL - Llamada a Stripe
  // ============================================================
  try {
    const paymentIntent = await stripeRequest('POST', '/payment_intents', {
      amount: amountInSmallestUnit,
      currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        ...metadata,
        integration: 'aeroshop-stripe-sandbox'
      },
      description: `AeroShop Order - ${metadata.orderId || 'preview'}`
    });

    return {
      id: paymentIntent.id,
      client_secret: paymentIntent.client_secret,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      metadata: paymentIntent.metadata
    };
  } catch (error) {
    console.error('[StripeService] Error creando PaymentIntent:', error.message);
    throw error;
  }
}

/**
 * Recupera un PaymentIntent por ID y verifica su estado.
 */
async function retrievePaymentIntent(paymentIntentId) {
  if (isMockMode && paymentIntentId && paymentIntentId.startsWith('pi_mock_')) {
    await new Promise(r => setTimeout(r, 80));
    return {
      id: paymentIntentId,
      status: 'succeeded',
      amount: 0,
      currency: 'cop',
      metadata: {},
      charges: []
    };
  }

  try {
    const pi = await stripeRequest('GET', `/payment_intents/${paymentIntentId}`);
    return {
      id: pi.id,
      status: pi.status,
      amount: pi.amount,
      currency: pi.currency,
      metadata: pi.metadata || {},
      charges: pi.charges?.data || []
    };
  } catch (error) {
    console.error('[StripeService] Error recuperando PaymentIntent:', error.message);
    throw error;
  }
}

/**
 * Confirma manualmente un PaymentIntent (usado raramente; normalmente lo hace el cliente con Stripe.js).
 */
async function confirmPaymentIntent(paymentIntentId, paymentMethodId = null) {
  const body = {};
  if (paymentMethodId) body.payment_method = paymentMethodId;

  try {
    const pi = await stripeRequest('POST', `/payment_intents/${paymentIntentId}/confirm`, body);
    return { id: pi.id, status: pi.status };
  } catch (error) {
    console.error('[StripeService] Error confirmando PaymentIntent:', error.message);
    throw error;
  }
}

/**
 * Cancela un PaymentIntent (útil para rollbacks).
 */
async function cancelPaymentIntent(paymentIntentId) {
  try {
    const pi = await stripeRequest('POST', `/payment_intents/${paymentIntentId}/cancel`);
    return { id: pi.id, status: pi.status };
  } catch (error) {
    console.error('[StripeService] Error cancelando PaymentIntent:', error.message);
    throw error;
  }
}

/**
 * Construye la respuesta de error amigable desde errores de Stripe.
 */
function formatStripeError(error) {
  if (error.raw && error.raw.error) {
    const stripeErr = error.raw.error;
    let userMessage = stripeErr.message || 'Error procesando el pago.';

    // Mapear códigos comunes de Stripe a mensajes claros en español
    switch (stripeErr.code) {
      case 'card_declined':
        userMessage = 'La tarjeta fue declinada. Verifica los datos o usa otra tarjeta de prueba.';
        break;
      case 'insufficient_funds':
        userMessage = 'Fondos insuficientes en la tarjeta.';
        break;
      case 'incorrect_cvc':
      case 'invalid_cvc':
        userMessage = 'El código de seguridad (CVC) es incorrecto.';
        break;
      case 'expired_card':
        userMessage = 'La tarjeta ha expirado.';
        break;
      case 'processing_error':
        userMessage = 'Error temporal procesando el pago. Intenta nuevamente.';
        break;
      case 'rate_limit':
        userMessage = 'Demasiadas solicitudes. Espera un momento.';
        break;
      case 'amount_too_small':
        userMessage = 'El monto del pedido es demasiado bajo para procesar el pago. Agrega más productos al carrito.';
        break;
    }

    return {
      success: false,
      status: 'failed',
      message: userMessage,
      code: stripeErr.code,
      type: stripeErr.type
    };
  }

  return {
    success: false,
    status: 'failed',
    message: error.message || 'Error desconocido con la pasarela de pago.'
  };
}

module.exports = {
  createPaymentIntent,
  retrievePaymentIntent,
  confirmPaymentIntent,
  cancelPaymentIntent,
  formatStripeError,
  toStripeAmount,
  fromStripeAmount,
  STRIPE_SECRET_KEY
};
