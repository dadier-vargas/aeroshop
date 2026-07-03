const { dbQuery } = require('../config/database');

/**
 * Servicio de Notificaciones del Sistema
 */
class NotifyService {
  /**
   * Crea una notificación para un usuario específico.
   * @param {number} userId - ID del usuario destinatario
   * @param {string} message - Contenido de la notificación
   * @param {string} type - Tipo de notificación ('order_status', 'refund_status', 'general')
   * @returns {Promise<boolean>} Éxito de la operación
   */
  static async create(userId, message, type = 'general') {
    try {
      await dbQuery.run(
        `INSERT INTO notifications (user_id, message, type, is_read) VALUES (?, ?, ?, 0)`,
        [userId, message, type]
      );
      return true;
    } catch (error) {
      console.error('Error al crear notificación en base de datos:', error.message);
      return false;
    }
  }

  /**
   * Obtiene todas las notificaciones de un usuario.
   * @param {number} userId - ID del usuario
   * @returns {Promise<Array>} Lista de notificaciones
   */
  static async getByUser(userId) {
    try {
      return await dbQuery.all(
        `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC`,
        [userId]
      );
    } catch (error) {
      console.error('Error al obtener notificaciones:', error.message);
      return [];
    }
  }

  /**
   * Marca una notificación como leída.
   * @param {number} notificationId - ID de la notificación
   * @param {number} userId - ID del usuario propietario (por seguridad)
   * @returns {Promise<boolean>}
   */
  static async markAsRead(notificationId, userId) {
    try {
      const result = await dbQuery.run(
        `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
        [notificationId, userId]
      );
      return result.changes > 0;
    } catch (error) {
      console.error('Error al marcar notificación como leída:', error.message);
      return false;
    }
  }
}

module.exports = NotifyService;
