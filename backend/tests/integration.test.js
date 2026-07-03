const assert = require('assert');
require('../config/env').bootstrapEnv();
process.env.NODE_ENV = 'development';
process.env.ALLOW_SIMULATED_PAYMENTS = 'true';
const app = require('../app');
const { dbQuery } = require('../config/database');
const {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_CLIENT_PASSWORD
} = require('../config/defaultCredentials');

const PORT = 5099; // Puerto aislado para pruebas

// Helper para logs coloreados
const log = {
  info: (msg) => console.log(`\x1b[34m[INFO]\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m[PASS]\x1b[0m ${msg}`),
  error: (msg) => console.error(`\x1b[31m[FAIL]\x1b[0m ${msg}`)
};

async function runTests() {
  const server = app.listen(PORT);
  log.info(`Servidor de pruebas levantado en http://localhost:${PORT}`);

  const baseUrl = `http://localhost:${PORT}/api`;
  let clientToken = '';
  let adminToken = '';
  let testOrderId = '';
  let testRefundId = '';
  let targetProductId = 1; // Auriculares Inalámbricos Pro (Semilla ID 1)
  
  try {
    log.info('=== INICIANDO PRUEBAS DE INTEGRACIÓN ===');

    // -------------------------------------------------------------
    // PRUEBA 1: Registro e Inicio de Sesión (Módulo Auth)
    // -------------------------------------------------------------
    log.info('Ejecutando Prueba 1: Registro e Inicio de Sesión...');
    
    const randomEmail = `test-client-${Math.random().toString(36).substring(2, 8)}@ecommerce.com`;
    
    // A. Registrar nuevo cliente
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: randomEmail,
        password: DEFAULT_CLIENT_PASSWORD,
        fullName: 'Prueba Integración'
      })
    });
    
    assert.strictEqual(regRes.status, 201, 'El registro del cliente debería retornar 201');
    const regData = await regRes.json();
    assert.ok(regData.token, 'El registro debería retornar un token JWT');
    clientToken = regData.token;
    log.success('Registro de cliente exitoso.');

    // B. Intentar registrar duplicado (debe fallar)
    const dupRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: randomEmail,
        password: 'anotherpassword',
        fullName: 'Duplicado'
      })
    });
    assert.strictEqual(dupRes.status, 400, 'El registro duplicado debería fallar con 400');
    log.success('Prevención de correos duplicados correcta.');

    // C. Login de Cliente
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: randomEmail,
        password: DEFAULT_CLIENT_PASSWORD
      })
    });
    assert.strictEqual(loginRes.status, 200, 'El inicio de sesión debería retornar 200');
    const loginData = await loginRes.json();
    assert.strictEqual(loginData.user.email, randomEmail, 'El email devuelto no coincide');
    log.success('Inicio de sesión de cliente exitoso.');

    // D. Login de Administrador (Sembrado por defecto)
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: DEFAULT_ADMIN_EMAIL,
        password: DEFAULT_ADMIN_PASSWORD
      })
    });
    assert.strictEqual(adminLoginRes.status, 200, 'El login del admin debería retornar 200');
    const adminLoginData = await adminLoginRes.json();
    assert.strictEqual(adminLoginData.user.role, 'admin', 'El rol debería ser admin');
    adminToken = adminLoginData.token;
    log.success('Inicio de sesión de administrador exitoso.');

    // -------------------------------------------------------------
    // PRUEBA 2: Preparación de Inventario (Admin CRUD)
    // -------------------------------------------------------------
    log.info('Ejecutando Prueba 2: Modificación de Inventario para pruebas...');
    
    // Ajustar el stock del producto 1 a 5 unidades mediante la API de administración
    const stockUpdateRes = await fetch(`${baseUrl}/admin/products/${targetProductId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ stock: 5 })
    });
    
    assert.strictEqual(stockUpdateRes.status, 200, 'La actualización de stock por admin debería retornar 200');
    const stockUpdateData = await stockUpdateRes.json();
    assert.strictEqual(stockUpdateData.product.stock, 5, 'El stock debería actualizarse a 5');
    log.success('Ajuste de stock del producto objetivo exitoso (Stock = 5).');

    // -------------------------------------------------------------
    // PRUEBA 3: Compra Exitosa (Checkout con Descuento y Pago)
    // -------------------------------------------------------------
    log.info('Ejecutando Prueba 3: Proceso de Checkout Exitoso (Monto & Descuentos)...');
    
    // Crear un pedido de 2 unidades (Producto vale 120,000 COP, total = 240,000)
    // Aplicando cupón DESCUENTO10 (10% descuento = -24,000, final = 216,000 COP)
    const checkoutRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${clientToken}`
      },
      body: JSON.stringify({
        items: [
          { productId: targetProductId, quantity: 2 }
        ],
        couponCode: 'DESCUENTO10',
        paymentMethod: 'card',
        paymentDetails: {
          cardNumber: '1234567812345678', // Tarjeta válida (simulada)
          expiryDate: '12/28',
          cvv: '123'
        }
      })
    });

    assert.strictEqual(checkoutRes.status, 201, 'La creación del pedido debería retornar 201');
    const checkoutData = await checkoutRes.json();
    assert.strictEqual(checkoutData.status, 'paid', 'El estado del pedido debería ser paid');
    assert.strictEqual(checkoutData.paymentStatus, 'completed', 'El estado del pago debería ser completed');
    assert.strictEqual(checkoutData.discountAmount, 24000, 'El descuento aplicado debería ser de $24,000');
    assert.strictEqual(checkoutData.finalAmount, 216000, 'El total final debería ser de $216,000');
    testOrderId = checkoutData.orderId;
    log.success(`Checkout exitoso. Pedido #${testOrderId} creado.`);

    // Verificar reducción de inventario
    const prodRes = await fetch(`${baseUrl}/products/${targetProductId}`);
    const prodData = await prodRes.json();
    assert.strictEqual(prodData.stock, 3, 'El stock del producto debería haber bajado de 5 a 3');
    log.success('Verificación de control de inventario en tiempo real correcta (Quedan 3 uds).');

    // -------------------------------------------------------------
    // PRUEBA 4: Control de Stock y Reversión en Pago Fallido
    // -------------------------------------------------------------
    log.info('Ejecutando Prueba 4: Validación de Stock Insuficiente y Reversión ante fallo en pago...');

    // A. Comprar más del stock disponible (3 disponibles, solicitamos 4) -> debe fallar
    const badStockRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${clientToken}`
      },
      body: JSON.stringify({
        items: [{ productId: targetProductId, quantity: 4 }],
        paymentMethod: 'card',
        paymentDetails: { cardNumber: '1234567812345678', expiryDate: '12/28', cvv: '123' }
      })
    });
    assert.strictEqual(badStockRes.status, 400, 'El pedido por exceso de stock debería fallar con 400');
    log.success('Filtro de stock insuficiente correcto.');

    // B. Comprar con saldo insuficiente (tarjeta terminada en 9999) -> debe fallar pago y reestablecer stock
    const badPaymentRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${clientToken}`
      },
      body: JSON.stringify({
        items: [{ productId: targetProductId, quantity: 2 }], // solicita 2, de 3 disponibles
        paymentMethod: 'card',
        paymentDetails: {
          cardNumber: '1234567812349999', // Tarjeta que gatilla fallo en PaymentService
          expiryDate: '12/28',
          cvv: '123'
        }
      })
    });
    assert.strictEqual(badPaymentRes.status, 400, 'El checkout debería fallar por pago rechazado');
    const badPaymentData = await badPaymentRes.json();
    assert.strictEqual(badPaymentData.status, 'cancelled', 'El estado del pedido fallido debería ser cancelled');
    log.success('Rechazo de pasarela de pagos simulado con éxito.');

    // C. Verificar que el stock de productos no se haya modificado (sigue siendo 3)
    const checkStockRes = await fetch(`${baseUrl}/products/${targetProductId}`);
    const checkStockData = await checkStockRes.json();
    assert.strictEqual(checkStockData.stock, 3, 'El stock debería mantenerse en 3 tras fallar el pago');
    log.success('Reversión y devolución de stock ante fallos de pago exitosa (Consistencia de inventario).');

    // -------------------------------------------------------------
    // PRUEBA 5: Ciclo de Vida del Reembolso (Solicitud -> Aprobación -> Restock)
    // -------------------------------------------------------------
    log.info('Ejecutando Prueba 5: Solicitud de Reembolso, Aprobación por Admin e Incremento de Stock...');

    // A. Enviar solicitud de reembolso del pedido exitoso (Pedido #testOrderId)
    const refundReqRes = await fetch(`${baseUrl}/refunds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${clientToken}`
      },
      body: JSON.stringify({
        orderId: testOrderId,
        reason: 'El producto llegó con el empaque averiado'
      })
    });
    assert.strictEqual(refundReqRes.status, 201, 'La solicitud de reembolso debería crearse con status 201');
    log.success('Solicitud de reembolso del cliente registrada.');

    // B. Obtener el ID del reembolso (vía API Admin de reembolsos)
    const adminRefundsRes = await fetch(`${baseUrl}/admin/refunds`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const adminRefunds = await adminRefundsRes.json();
    const targetRefund = adminRefunds.find(r => r.order_id === testOrderId);
    assert.ok(targetRefund, 'Debería encontrarse el reembolso en la lista de administración');
    testRefundId = targetRefund.id;
    assert.strictEqual(targetRefund.status, 'pending', 'El reembolso debería estar en estado pending');

    // C. Aprobar el reembolso por el Administrador
    const approveRefundRes = await fetch(`${baseUrl}/admin/refunds/${testRefundId}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        action: 'approve',
        adminNotes: 'Aprobado tras verificar fotos de la avería. Devolución de dinero exitosa.'
      })
    });
    assert.strictEqual(approveRefundRes.status, 200, 'El procesamiento del reembolso debería retornar 200');
    const approveRefundData = await approveRefundRes.json();
    assert.strictEqual(approveRefundData.status, 'approved', 'El reembolso debería quedar approved');
    assert.strictEqual(approveRefundData.orderStatus, 'refunded', 'El pedido debería quedar refunded');
    log.success('Aprobación de reembolso por el administrador procesada correctamente.');

    // D. Verificar que los 2 productos devueltos se hayan re-sumado al inventario (3 + 2 = 5)
    const finalProdRes = await fetch(`${baseUrl}/products/${targetProductId}`);
    const finalProdData = await finalProdRes.json();
    assert.strictEqual(finalProdData.stock, 5, 'El stock debería volver a ser 5 tras el reembolso');
    log.success('Reposición de stock automática por reembolso exitosa (Consistencia final).');

    // E. Consultar notificaciones recibidas por el cliente
    const notifRes = await fetch(`${baseUrl}/notifications`, {
      headers: { 'Authorization': `Bearer ${clientToken}` }
    });
    const notifs = await notifRes.json();
    assert.ok(notifs.length >= 2, 'El cliente debería tener al menos la notificación de compra y reembolso');
    log.success('Registro de notificaciones de estado correcto.');

    log.success('=== TODAS LAS PRUEBAS DE INTEGRACIÓN SE COMPLETARON CON ÉXITO ===');
  } catch (error) {
    log.error('Fallo en las pruebas de integración:');
    console.error(error);
    process.exitCode = 1;
  } finally {
    log.info('Apagando servidor de pruebas...');
    server.close(() => {
      log.info('Servidor HTTP de pruebas cerrado.');
      // Cerrar conexiones abiertas de base de datos
      const { db } = require('../config/database');
      db.close(() => {
        log.info('Conexión de base de datos cerrada.');
      });
    });
  }
}

// Ejecutar pruebas
runTests();
