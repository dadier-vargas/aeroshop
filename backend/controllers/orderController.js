const { dbQuery } = require('../config/database');
const PaymentService = require('../services/paymentService');
const StripeService = require('../services/stripeService');
const NotifyService = require('../services/notifyService');
const { validateStripePaymentIntent } = require('../utils/paymentValidation');

/**
 * Controlador de Pedidos y Cupones
 */
class OrderController {
  /**
   * Valida un código de cupón.
   */
  static async validateCoupon(req, res) {
    const { code, orderTotal } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'El código de cupón es obligatorio' });
    }

    try {
      const coupon = await dbQuery.get('SELECT * FROM coupons WHERE code = ?', [code.toUpperCase()]);

      if (!coupon) {
        return res.status(404).json({ isValid: false, error: 'El cupón ingresado no existe' });
      }

      if (coupon.active !== 1) {
        return res.status(400).json({ isValid: false, error: 'El cupón no se encuentra activo' });
      }

      // Validar fecha de expiración
      const now = new Date();
      const expiresAt = new Date(coupon.expires_at);
      if (now > expiresAt) {
        return res.status(400).json({ isValid: false, error: 'El cupón ha expirado' });
      }

      // Validar monto mínimo si se provee un total
      if (orderTotal !== undefined && orderTotal < coupon.min_order_value) {
        return res.status(400).json({
          isValid: false,
          error: `El total de la compra debe ser de al menos $${coupon.min_order_value} para aplicar este cupón`
        });
      }

      return res.status(200).json({
        isValid: true,
        coupon: {
          id: coupon.id,
          code: coupon.code,
          discount_type: coupon.discount_type,
          discount_value: coupon.discount_value,
          min_order_value: coupon.min_order_value
        }
      });
    } catch (error) {
      console.error('Error al validar cupón:', error);
      return res.status(500).json({ error: 'Error del servidor al validar el cupón' });
    }
  }

  /**
   * Crea un nuevo pedido procesando el inventario y pago.
   */
  static async createOrder(req, res) {
    const userId = req.user.id;
    const { items, couponCode, paymentMethod, paymentDetails } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'El carrito de compras no puede estar vacío' });
    }

    if (!paymentMethod || !paymentDetails) {
      return res.status(400).json({ error: 'El método de pago y sus detalles son obligatorios' });
    }

    // Extraer paymentIntentId de Stripe si viene del frontend (flujo seguro)
    const stripePaymentIntentId = paymentDetails.paymentIntentId || paymentDetails.payment_intent_id || null;

    try {
      // 1. Iniciar Transacción en base de datos para asegurar consistencia
      await dbQuery.run('BEGIN TRANSACTION;');

      let totalAmount = 0;
      const verifiedItems = [];

      // Verificar stock y calcular precios de cada producto
      for (const item of items) {
        const product = await dbQuery.get('SELECT * FROM products WHERE id = ?', [item.productId]);

        if (!product) {
          await dbQuery.run('ROLLBACK;');
          return res.status(404).json({ error: `El producto con ID ${item.productId} no existe` });
        }

        if (product.stock < item.quantity) {
          await dbQuery.run('ROLLBACK;');
          return res.status(400).json({
            error: `Stock insuficiente para ${product.name}. Disponible: ${product.stock}, Solicitado: ${item.quantity}`
          });
        }

        const itemTotal = product.price * item.quantity;
        totalAmount += itemTotal;

        verifiedItems.push({
          product,
          quantity: item.quantity,
          unitPrice: product.price,
          totalPrice: itemTotal
        });
      }

      // 2. Aplicar descuento de cupón si existe
      let discountAmount = 0;
      let couponId = null;

      if (couponCode) {
        const coupon = await dbQuery.get('SELECT * FROM coupons WHERE code = ?', [couponCode.toUpperCase()]);

        if (coupon && coupon.active === 1 && new Date() <= new Date(coupon.expires_at) && totalAmount >= coupon.min_order_value) {
          couponId = coupon.id;
          if (coupon.discount_type === 'percentage') {
            discountAmount = (totalAmount * coupon.discount_value) / 100;
          } else if (coupon.discount_type === 'fixed') {
            discountAmount = coupon.discount_value;
          }
          // Redondear descuento
          discountAmount = Math.min(discountAmount, totalAmount);
        }
      }

      const finalAmount = totalAmount - discountAmount;

      // 3. Crear el registro del Pedido en estado 'pending'
      const trackingNumber = 'TRK-' + Math.random().toString(36).substring(2, 9).toUpperCase();
      
      const orderResult = await dbQuery.run(
        `INSERT INTO orders (user_id, status, total_amount, discount_amount, final_amount, coupon_id, payment_method, payment_status, payment_intent_id, tracking_number)
         VALUES (?, 'pending', ?, ?, ?, ?, ?, 'pending', ?, ?)`,
        [userId, totalAmount, discountAmount, finalAmount, couponId, paymentMethod, stripePaymentIntentId || null, trackingNumber]
      );

      const orderId = orderResult.lastID;

      // 4. Crear los detalles del Pedido e ir decrementando inventario
      for (const item of verifiedItems) {
        await dbQuery.run(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?)`,
          [orderId, item.product.id, item.quantity, item.unitPrice, item.totalPrice]
        );

        // Reducir stock del producto
        const newStock = item.product.stock - item.quantity;
        await dbQuery.run('UPDATE products SET stock = ? WHERE id = ?', [newStock, item.product.id]);
      }

      // Guardar cambios intermedios de la base de datos antes de llamar a la API externa de pagos
      await dbQuery.run('COMMIT;');

      // 5. Procesar Pago: 
      //   - Para 'card' + paymentDetails.paymentIntentId: usar Stripe REAL (verificar succeeded)
      //   - De lo contrario: usar simulación legacy (PSE, Wallet, o pruebas sin Stripe)
      let paymentResult;

      if (paymentMethod === 'card' && stripePaymentIntentId) {
        try {
          const pi = await StripeService.retrievePaymentIntent(stripePaymentIntentId);
          const validation = await validateStripePaymentIntent(pi, {
            userId,
            expectedAmount: finalAmount,
            paymentIntentId: stripePaymentIntentId
          });

          if (validation.valid) {
            paymentResult = {
              success: true,
              status: 'completed',
              transactionId: stripePaymentIntentId,
              message: 'Pago confirmado vía Stripe (sandbox).'
            };
          } else {
            paymentResult = { success: false, status: 'failed', message: validation.message };
          }
        } catch (stripeErr) {
          console.error('[Order] Error verificando PaymentIntent de Stripe:', stripeErr.message);
          paymentResult = StripeService.formatStripeError(stripeErr);
        }
      } else if (paymentMethod === 'pse' || paymentMethod === 'wallet' || PaymentService.isSimulationAllowed(paymentMethod)) {
        paymentResult = await PaymentService.processPayment(paymentMethod, finalAmount, paymentDetails);
      } else {
        paymentResult = {
          success: false,
          status: 'failed',
          message: 'Método de pago no disponible. Use tarjeta con Stripe en producción.'
        };
      }

      if (paymentResult.success) {
        // Pago exitoso: Actualizar pedido a 'paid' y pago a 'completed' + guardar referencia Stripe si existe
        await dbQuery.run(
          `UPDATE orders 
           SET status = 'paid', payment_status = 'completed', payment_intent_id = COALESCE(?, payment_intent_id) 
           WHERE id = ?`,
          [stripePaymentIntentId, orderId]
        );

        // Enviar notificación al usuario
        await NotifyService.create(
          userId,
          `¡Tu pago por $${finalAmount.toLocaleString('es-CO')} ha sido aprobado! Tu número de seguimiento es ${trackingNumber}.`,
          'order_status'
        );

        return res.status(201).json({
          message: 'Pedido realizado con éxito',
          orderId,
          trackingNumber,
          totalAmount,
          discountAmount,
          finalAmount,
          status: 'paid',
          paymentStatus: 'completed',
          paymentIntentId: stripePaymentIntentId || paymentResult.transactionId || null
        });
      } else {
        // El pago falló: Cancelar pedido en base de datos y restablecer el stock
        await dbQuery.run('BEGIN TRANSACTION;');

        await dbQuery.run(
          `UPDATE orders 
           SET status = 'cancelled', payment_status = 'failed' 
           WHERE id = ?`,
          [orderId]
        );

        // Restablecer stock de productos
        for (const item of verifiedItems) {
          await dbQuery.run(
            `UPDATE products SET stock = stock + ? WHERE id = ?`,
            [item.quantity, item.product.id]
          );
        }

        await dbQuery.run('COMMIT;');

        // Notificar al usuario sobre el fallo
        await NotifyService.create(
          userId,
          `El pago de tu pedido #${orderId} fue rechazado. Motivo: ${paymentResult.message}. El stock ha sido liberado.`,
          'order_status'
        );

        return res.status(400).json({
          error: `Error al procesar el pago: ${paymentResult.message}. El pedido ha sido cancelado.`,
          orderId,
          status: 'cancelled',
          paymentStatus: 'failed'
        });
      }
    } catch (error) {
      console.error('Error al procesar el pedido:', error);
      // Intentar hacer rollback por si ocurre un fallo durante la transacción activa
      try {
        await dbQuery.run('ROLLBACK;');
      } catch (rErr) {
        // Ignorar si no había transacción activa
      }
      return res.status(500).json({ error: 'Error interno del servidor al procesar el pedido' });
    }
  }

  /**
   * Obtiene el historial de pedidos del usuario autenticado.
   */
  static async getMyOrders(req, res) {
    const userId = req.user.id;

    try {
      const orders = await dbQuery.all(
        `SELECT o.*, 
                (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as total_items
         FROM orders o 
         WHERE o.user_id = ? 
         ORDER BY o.created_at DESC`,
        [userId]
      );
      return res.status(200).json(orders);
    } catch (error) {
      console.error('Error al obtener pedidos:', error);
      return res.status(500).json({ error: 'Error al obtener historial de pedidos' });
    }
  }

  /**
   * Obtiene detalles de un pedido específico.
   */
  static async getOrderById(req, res) {
    const orderId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    try {
      // Obtener datos del pedido
      const order = await dbQuery.get('SELECT * FROM orders WHERE id = ?', [orderId]);

      if (!order) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
      }

      // Seguridad: Asegurar que el pedido pertenezca al usuario, o que sea administrador
      if (order.user_id !== userId && userRole !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado. No posee permisos para ver este pedido' });
      }

      // Obtener los productos del pedido
      const items = await dbQuery.all(
        `SELECT oi.*, p.name as product_name, p.image_url 
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
        [orderId]
      );

      // Obtener reembolso si existe
      const refund = await dbQuery.get('SELECT * FROM refunds WHERE order_id = ?', [orderId]);

      return res.status(200).json({
        ...order,
        items,
        refund: refund || null
      });
    } catch (error) {
      console.error('Error al obtener detalles del pedido:', error);
      return res.status(500).json({ error: 'Error al obtener los detalles del pedido' });
    }
  }
}

module.exports = OrderController;
