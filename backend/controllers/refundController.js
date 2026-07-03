const { dbQuery } = require('../config/database');
const PaymentService = require('../services/paymentService');
const NotifyService = require('../services/notifyService');

/**
 * Controlador de Reembolsos
 * Maneja flujos de cliente (solicitudes) y de administrador (procesamiento).
 */
class RefundController {
  /**
   * Permite a un cliente solicitar un reembolso.
   */
  static async requestRefund(req, res) {
    const userId = req.user.id;
    const { orderId, reason } = req.body;

    if (!orderId || !reason) {
      return res.status(400).json({ error: 'El ID de pedido y el motivo de reembolso son obligatorios' });
    }

    try {
      // 1. Obtener detalles del pedido
      const order = await dbQuery.get('SELECT * FROM orders WHERE id = ?', [orderId]);

      if (!order) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
      }

      // Seguridad: Verificar que el pedido pertenezca al usuario solicitante
      if (order.user_id !== userId) {
        return res.status(403).json({ error: 'Acceso denegado. Este pedido pertenece a otro usuario' });
      }

      // Validar elegibilidad del reembolso: Debe estar pagado ('paid') o entregado ('delivered')
      if (order.status !== 'paid' && order.status !== 'delivered') {
        return res.status(400).json({
          error: `El pedido no es elegible para reembolso. Estado actual: ${order.status}. Debe estar pagado o entregado.`
        });
      }

      // Verificar si ya existe una solicitud de reembolso para este pedido
      const existingRefund = await dbQuery.get('SELECT id, status FROM refunds WHERE order_id = ?', [orderId]);
      if (existingRefund) {
        return res.status(400).json({
          error: `Ya existe una solicitud de reembolso para este pedido. Estado actual de la solicitud: ${existingRefund.status}`
        });
      }

      // 2. Iniciar transacción para actualizar estado del pedido y registrar reembolso
      await dbQuery.run('BEGIN TRANSACTION;');

      // Insertar el reembolso en estado pendiente
      await dbQuery.run(
        `INSERT INTO refunds (order_id, reason, status, requested_at) VALUES (?, ?, 'pending', CURRENT_TIMESTAMP)`,
        [orderId, reason]
      );

      // Actualizar estado del pedido a 'refund_requested'
      await dbQuery.run(
        `UPDATE orders SET status = 'refund_requested' WHERE id = ?`,
        [orderId]
      );

      await dbQuery.run('COMMIT;');

      // Notificar al usuario que su solicitud está siendo revisada
      await NotifyService.create(
        userId,
        `Tu solicitud de reembolso para el pedido #${orderId} ha sido recibida y se encuentra en revisión.`,
        'refund_status'
      );

      // (Opcional) Notificar a los administradores
      const admins = await dbQuery.all("SELECT id FROM users WHERE role = 'admin'");
      for (const admin of admins) {
        await NotifyService.create(
          admin.id,
          `Nueva solicitud de reembolso recibida para el pedido #${orderId}.`,
          'general'
        );
      }

      return res.status(201).json({
        message: 'Solicitud de reembolso registrada exitosamente. Se encuentra bajo revisión de un administrador.',
        orderId,
        status: 'refund_requested'
      });
    } catch (error) {
      console.error('Error al solicitar reembolso:', error);
      try {
        await dbQuery.run('ROLLBACK;');
      } catch (rErr) {}
      return res.status(500).json({ error: 'Error interno del servidor al procesar la solicitud de reembolso' });
    }
  }

  /**
   * Permite a un administrador procesar (aprobar o rechazar) un reembolso.
   */
  static async processRefund(req, res) {
    const refundId = req.params.id;
    const { action, adminNotes } = req.body; // action: 'approve' o 'reject'

    if (!action || (action !== 'approve' && action !== 'reject')) {
      return res.status(400).json({ error: "La acción es obligatoria y debe ser 'approve' o 'reject'" });
    }

    try {
      // 1. Obtener detalles de la solicitud de reembolso
      const refund = await dbQuery.get('SELECT * FROM refunds WHERE id = ?', [refundId]);
      if (!refund) {
        return res.status(404).json({ error: 'Solicitud de reembolso no encontrada' });
      }

      if (refund.status !== 'pending') {
        return res.status(400).json({ error: `Esta solicitud ya ha sido procesada. Estado: ${refund.status}` });
      }

      // Obtener detalles del pedido asociado
      const order = await dbQuery.get('SELECT * FROM orders WHERE id = ?', [refund.order_id]);
      if (!order) {
        return res.status(404).json({ error: 'Pedido asociado al reembolso no encontrado' });
      }

      const clientUserId = order.user_id;

      if (action === 'approve') {
        // APROBACIÓN DE REEMBOLSO
        // A. Reversar dinero mediante la pasarela de pagos (Mock)
        const refundResult = await PaymentService.processRefund(order.tracking_number, order.final_amount);

        if (!refundResult.success) {
          return res.status(500).json({ error: `La pasarela de pago falló al procesar el reembolso: ${refundResult.message}` });
        }

        // B. Iniciar transacción en base de datos para reponer stock y actualizar estados
        await dbQuery.run('BEGIN TRANSACTION;');

        // Actualizar reembolso a aprobado
        await dbQuery.run(
          `UPDATE refunds 
           SET status = 'approved', processed_at = CURRENT_TIMESTAMP, admin_notes = ? 
           WHERE id = ?`,
          [adminNotes || 'Reembolso aprobado por el administrador', refundId]
        );

        // Actualizar estado de pedido y pago
        await dbQuery.run(
          `UPDATE orders 
           SET status = 'refunded', payment_status = 'refunded' 
           WHERE id = ?`,
          [order.id]
        );

        // Reponer stock de productos
        const orderItems = await dbQuery.all('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [order.id]);
        for (const item of orderItems) {
          await dbQuery.run(
            `UPDATE products SET stock = stock + ? WHERE id = ?`,
            [item.quantity, item.product_id]
          );
        }

        await dbQuery.run('COMMIT;');

        // Notificar al cliente
        await NotifyService.create(
          clientUserId,
          `¡Tu reembolso para el pedido #${order.id} ha sido aprobado! El monto de $${order.final_amount.toLocaleString('es-CO')} ha sido devuelto a tu medio de pago original.`,
          'refund_status'
        );

        return res.status(200).json({
          message: 'Reembolso aprobado y procesado con éxito. Inventario restablecido.',
          refundId,
          orderId: order.id,
          status: 'approved',
          orderStatus: 'refunded'
        });

      } else {
        // RECHAZO DE REEMBOLSO
        await dbQuery.run('BEGIN TRANSACTION;');

        // Actualizar reembolso a rechazado
        await dbQuery.run(
          `UPDATE refunds 
           SET status = 'rejected', processed_at = CURRENT_TIMESTAMP, admin_notes = ? 
           WHERE id = ?`,
          [adminNotes || 'Reembolso rechazado por el administrador', refundId]
        );

        // Devolver pedido a su estado original (ej. 'paid' o 'delivered' según corresponda, por defecto reestablecemos a 'paid')
        await dbQuery.run(
          `UPDATE orders SET status = 'paid' WHERE id = ?`,
          [order.id]
        );

        await dbQuery.run('COMMIT;');

        // Notificar al cliente
        await NotifyService.create(
          clientUserId,
          `Tu solicitud de reembolso para el pedido #${order.id} ha sido rechazada. Notas: ${adminNotes || 'Sin notas adicionales'}.`,
          'refund_status'
        );

        return res.status(200).json({
          message: 'Reembolso rechazado exitosamente. El pedido vuelve a estar activo.',
          refundId,
          orderId: order.id,
          status: 'rejected',
          orderStatus: 'paid'
        });
      }

    } catch (error) {
      console.error('Error al procesar el reembolso:', error);
      try {
        await dbQuery.run('ROLLBACK;');
      } catch (rErr) {}
      return res.status(500).json({ error: 'Error interno del servidor al procesar el reembolso' });
    }
  }

  /**
   * Obtiene la lista de reembolsos (para el Administrador).
   */
  static async getAllRefunds(req, res) {
    try {
      const refunds = await dbQuery.all(
        `SELECT r.*, o.total_amount, o.final_amount, o.tracking_number, u.email as client_email, u.full_name as client_name
         FROM refunds r
         JOIN orders o ON r.order_id = o.id
         JOIN users u ON o.user_id = u.id
         ORDER BY r.requested_at DESC`
      );
      return res.status(200).json(refunds);
    } catch (error) {
      console.error('Error al obtener reembolsos:', error);
      return res.status(500).json({ error: 'Error al obtener la lista de reembolsos' });
    }
  }
}

module.exports = RefundController;
