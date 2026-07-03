const NotifyService = require('../services/notifyService');

/**
 * Controlador de Notificaciones para el Cliente
 */
class NotificationController {
  /**
   * Obtiene todas las notificaciones del cliente autenticado.
   */
  static async getNotifications(req, res) {
    const userId = req.user.id;

    try {
      const notifications = await NotifyService.getByUser(userId);
      return res.status(200).json(notifications);
    } catch (error) {
      console.error('Error al obtener notificaciones:', error);
      return res.status(500).json({ error: 'Error al obtener las notificaciones' });
    }
  }

  /**
   * Marca una notificación específica como leída.
   */
  static async markAsRead(req, res) {
    const notificationId = req.params.id;
    const userId = req.user.id;

    try {
      const success = await NotifyService.markAsRead(notificationId, userId);

      if (!success) {
        return res.status(404).json({ error: 'Notificación no encontrada o no pertenece al usuario' });
      }

      return res.status(200).json({ message: 'Notificación marcada como leída con éxito' });
    } catch (error) {
      console.error('Error al marcar notificación como leída:', error);
      return res.status(500).json({ error: 'Error al actualizar estado de la notificación' });
    }
  }
}

module.exports = NotificationController;
