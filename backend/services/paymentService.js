/**
 * Servicio de Simulación de Pasarela de Pagos
 * Soporta Tarjeta de Crédito, PSE y Billetera Digital (Wallet).
 * Solo disponible fuera de producción (o con ALLOW_SIMULATED_PAYMENTS=true).
 */
class PaymentService {
  static isSimulationAllowed(method) {
    if (method === 'pse' || method === 'wallet') {
      return true;
    }
    return (
      process.env.NODE_ENV !== 'production' ||
      process.env.ALLOW_SIMULATED_PAYMENTS === 'true'
    );
  }
  /**
   * Procesa un pago simulado.
   * @param {string} method - 'card', 'pse', 'wallet'
   * @param {number} amount - Valor de la transacción
   * @param {object} details - Datos específicos del método
   * @returns {Promise<object>} Resultado del pago
   */
  static async processPayment(method, amount, details) {
    if (!PaymentService.isSimulationAllowed(method)) {
      return {
        success: false,
        status: 'failed',
        message: 'Los pagos simulados están deshabilitados en producción.'
      };
    }

    return new Promise((resolve, reject) => {
      // Simular latencia de red de pasarela de pagos
      setTimeout(() => {
        if (!method || !amount || amount <= 0) {
          return resolve({
            success: false,
            status: 'failed',
            message: 'Monto inválido o método de pago faltante.'
          });
        }

        const transactionId = 'TXN-' + Math.random().toString(36).substring(2, 11).toUpperCase();

        switch (method) {
          case 'card':
            if (!details.cardNumber || !details.expiryDate || !details.cvv) {
              return resolve({
                success: false,
                status: 'failed',
                message: 'Información de tarjeta de crédito incompleta.'
              });
            }
            // Simulación de fallo provocado para pruebas
            if (details.cardNumber.endsWith('9999')) {
              return resolve({
                success: false,
                status: 'failed',
                message: 'Transacción declinada por fondos insuficientes.'
              });
            }
            return resolve({
              success: true,
              status: 'completed',
              transactionId,
              message: 'Pago con tarjeta de crédito aprobado con éxito.'
            });

          case 'pse':
            if (!details.bankName || !details.userDocument) {
              return resolve({
                success: false,
                status: 'failed',
                message: 'Información de transferencia PSE incompleta.'
              });
            }
            // Simular rechazo PSE para pruebas
            if (details.bankName.toLowerCase().includes('rechazo')) {
              return resolve({
                success: false,
                status: 'failed',
                message: 'Transacción PSE rechazada por la entidad bancaria.'
              });
            }
            return resolve({
              success: true,
              status: 'completed',
              transactionId,
              message: 'Transferencia bancaria PSE autorizada.'
            });

          case 'wallet':
            if (!details.phoneNumber || !details.otpCode) {
              return resolve({
                success: false,
                status: 'failed',
                message: 'Información de Billetera Digital incompleta.'
              });
            }
            // Simular código OTP incorrecto para pruebas
            if (details.otpCode === '0000') {
              return resolve({
                success: false,
                status: 'failed',
                message: 'Código de verificación OTP incorrecto.'
              });
            }
            return resolve({
              success: true,
              status: 'completed',
              transactionId,
              message: 'Pago mediante billetera digital procesado con éxito.'
            });

          default:
            return resolve({
              success: false,
              status: 'failed',
              message: 'Método de pago no soportado por el sistema.'
            });
        }
      }, 500); // Latencia de 500ms
    });
  }

  /**
   * Procesa la devolución/reversa de un pago.
   * @param {string} transactionId - ID de la transacción original
   * @param {number} amount - Monto a devolver
   * @returns {Promise<object>} Resultado de la reversa
   */
  static async processRefund(transactionId, amount) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          status: 'refunded',
          refundId: 'REF-' + Math.random().toString(36).substring(2, 11).toUpperCase(),
          message: `Reversa de pago por valor de $${amount} procesada exitosamente.`
        });
      }, 400);
    });
  }
}

module.exports = PaymentService;
