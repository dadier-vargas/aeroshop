/**
 * Cliente API HTTP para AeroShop con Fallback Automático a Simulación Local
 * Encapsula la comunicación con la API Express Backend. Si el servidor está offline,
 * emula todas las operaciones en localStorage para un funcionamiento 100% autónomo.
 */
// URL base de la API — se resuelve dinámicamente desde el mismo origen o /api/config/public
let API_BASE_URL = `${window.location.origin}/api`;
let allowOfflineMock = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Estado de simulación
let useLocalMock = false;

async function resolveApiConfig() {
  try {
    const response = await fetch(`${window.location.origin}/api/config/public`, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) return;
    const cfg = await response.json();
    if (cfg.apiBaseUrl) {
      const base = cfg.apiBaseUrl.startsWith('http')
        ? cfg.apiBaseUrl
        : `${window.location.origin}${cfg.apiBaseUrl}`;
      API_BASE_URL = base.replace(/\/$/, '');
    }
    if (typeof cfg.allowOfflineMock === 'boolean') {
      allowOfflineMock = cfg.allowOfflineMock;
    }
  } catch (_) {
    // Mantener valores por defecto si el backend aún no responde
  }
}

const apiConfigReady = resolveApiConfig();

// Hash simple para modo demo offline (no almacena contraseñas en texto plano)
function mockPasswordHash(password) {
  let hash = 5381;
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) + hash) + password.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

const DEMO_ADMIN_PASSWORD = 'ChgMe!AeroAdmin9';
const DEMO_CLIENT_PASSWORD = 'ChgMe!Cliente9';

const DEMO_MOCK_ACCOUNTS = {
  'admin@ecommerce.com': {
    passwordHash: mockPasswordHash(DEMO_ADMIN_PASSWORD),
    user: {
      id: 1,
      email: 'admin@ecommerce.com',
      full_name: 'Administrador Principal',
      role: 'admin',
      auth_provider: 'email'
    }
  },
  'cliente@ecommerce.com': {
    passwordHash: mockPasswordHash(DEMO_CLIENT_PASSWORD),
    user: {
      id: 2,
      email: 'cliente@ecommerce.com',
      full_name: 'Elian Perez',
      role: 'client',
      auth_provider: 'email'
    }
  }
};

// Versión del mock local: incrementar al cambiar credenciales o esquema demo
const MOCK_DB_VERSION = '2';

// Base de Datos en Memoria / LocalStorage para Simulación Offline
const MockDB = {
  init() {
    if (localStorage.getItem('aero_db_version') !== MOCK_DB_VERSION) {
      [
        'aero_db_initialized', 'aero_db_categories', 'aero_db_products', 'aero_db_users',
        'aero_db_coupons', 'aero_db_orders', 'aero_db_refunds', 'aero_db_notifications'
      ].forEach((key) => localStorage.removeItem(key));
      localStorage.setItem('aero_db_version', MOCK_DB_VERSION);
    }

    if (localStorage.getItem('aero_db_initialized')) return;

    const categories = [
      { id: 1, name: 'Tecnología', description: 'Dispositivos electrónicos y accesorios', slug: 'tecnologia' },
      { id: 2, name: 'Moda', description: 'Prendas de vestir y calzado', slug: 'moda' },
      { id: 3, name: 'Hogar y Cocina', description: 'Electrodomésticos y decoración', slug: 'hogar-cocina' },
      { id: 4, name: 'Deportes y Fitness', description: 'Equipamiento y ropa deportiva', slug: 'deportes-fitness' }
    ];

    const products = [
      { id: 1, name: 'Auriculares Inalámbricos Pro', description: 'Auriculares con cancelación activa de ruido y autonomía de 30 horas.', price: 120000.0, stock: 15, image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60', category_id: 1, category_name: 'Tecnología' },
      { id: 2, name: 'Smartphone Android X10', description: 'Pantalla AMOLED de 6.5 pulgadas, 128GB de almacenamiento y triple cámara.', price: 899000.0, stock: 8, image_url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&auto=format&fit=crop&q=60', category_id: 1, category_name: 'Tecnología' },
      { id: 3, name: 'Teclado Mecánico RGB', description: 'Teclado mecánico con switches rojos para gaming y oficina con iluminación RGB.', price: 180000.0, stock: 25, image_url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=60', category_id: 1, category_name: 'Tecnología' },
      { id: 4, name: 'Cargador Rápido GaN 65W', description: 'Cargador de pared con doble puerto USB-C y puerto USB-A, ideal para laptops.', price: 75000.0, stock: 50, image_url: 'https://images.unsplash.com/photo-1622445262465-2481c4574875?w=500&auto=format&fit=crop&q=60', category_id: 1, category_name: 'Tecnología' },
      { id: 5, name: 'Chaqueta de Mezclilla Unisex', description: 'Chaqueta de jeans clásica, corte holgado y botones metálicos.', price: 150000.0, stock: 20, image_url: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=500&auto=format&fit=crop&q=60', category_id: 2, category_name: 'Moda' },
      { id: 6, name: 'Tenis Deportivos Confort', description: 'Calzado ultraligero con suela amortiguadora para correr.', price: 220000.0, stock: 12, image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&auto=format&fit=crop&q=60', category_id: 2, category_name: 'Moda' },
      { id: 7, name: 'Camiseta de Algodón Orgánico', description: 'Camiseta de cuello redondo 100% algodón orgánico, suave.', price: 45000.0, stock: 40, image_url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500&auto=format&fit=crop&q=60', category_id: 2, category_name: 'Moda' },
      { id: 8, name: 'Cafetera de Goteo Programable', description: 'Cafetera automática con jarra de vidrio de 1.25 litros y filtro.', price: 195000.0, stock: 10, image_url: 'https://images.unsplash.com/photo-1517256064527-09c53b2d0bc6?w=500&auto=format&fit=crop&q=60', category_id: 3, category_name: 'Hogar y Cocina' },
      { id: 9, name: 'Lámpara de Escritorio Inteligente', description: 'Lámpara LED con control de temperatura de color y brillo regulable.', price: 90000.0, stock: 30, image_url: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500&auto=format&fit=crop&q=60', category_id: 3, category_name: 'Hogar y Cocina' },
      { id: 10, name: 'Tapete de Yoga Antideslizante', description: 'Tapete de caucho ecológico de 6mm de grosor con líneas de alineación.', price: 80000.0, stock: 35, image_url: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500&auto=format&fit=crop&q=60', category_id: 4, category_name: 'Deportes y Fitness' }
    ];

    const users = [
      { id: 1, email: 'admin@ecommerce.com', password_hash: DEMO_MOCK_ACCOUNTS['admin@ecommerce.com'].passwordHash, full_name: 'Administrador Principal', role: 'admin', auth_provider: 'email', created_at: new Date().toISOString() },
      { id: 2, email: 'cliente@ecommerce.com', password_hash: DEMO_MOCK_ACCOUNTS['cliente@ecommerce.com'].passwordHash, full_name: 'Elian Perez', role: 'client', auth_provider: 'email', created_at: new Date().toISOString() }
    ];

    const coupons = [
      { id: 1, code: 'DESCUENTO10', discount_type: 'percentage', discount_value: 10.0, min_order_value: 50000.0, active: 1, expires_at: '2028-12-31' },
      { id: 2, code: 'SALE50K', discount_type: 'fixed', discount_value: 50000.0, min_order_value: 300000.0, active: 1, expires_at: '2028-12-31' },
      { id: 3, code: 'BIENVENIDA', discount_type: 'percentage', discount_value: 15.0, min_order_value: 0.0, active: 1, expires_at: '2028-12-31' }
    ];

    localStorage.setItem('aero_db_categories', JSON.stringify(categories));
    localStorage.setItem('aero_db_products', JSON.stringify(products));
    localStorage.setItem('aero_db_users', JSON.stringify(users));
    localStorage.setItem('aero_db_coupons', JSON.stringify(coupons));
    localStorage.setItem('aero_db_orders', JSON.stringify([]));
    localStorage.setItem('aero_db_refunds', JSON.stringify([]));
    localStorage.setItem('aero_db_notifications', JSON.stringify([
      { id: 1, user_id: 2, message: '¡Te damos la bienvenida a AeroShop! Disfruta de una experiencia premium en tus compras.', is_read: 0, type: 'general', created_at: new Date().toISOString() }
    ]));
    localStorage.setItem('aero_db_initialized', 'true');
  },

  get(table) {
    this.init();
    return JSON.parse(localStorage.getItem(`aero_db_${table}`) || '[]');
  },

  save(table, data) {
    localStorage.setItem(`aero_db_${table}`, JSON.stringify(data));
  }
};

const API = {
  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('aero_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  },

  async handleResponse(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('aero_token');
        localStorage.removeItem('aero_user');
        window.dispatchEvent(new Event('authChange'));
      }
      throw new Error(data.error || data.message || 'Error en el servidor');
    }
    return data;
  },

  // Banner visual informando modo offline
  showOfflineBanner() {
    if (document.getElementById('aero-offline-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'aero-offline-banner';
    banner.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 24px;
      background: rgba(245, 158, 11, 0.95);
      color: #000;
      padding: 8px 18px;
      font-size: 0.8rem;
      font-weight: 700;
      border-radius: 20px;
      z-index: 9999;
      box-shadow: 0 4px 15px rgba(0,0,0,0.5);
      pointer-events: none;
      font-family: 'Outfit', sans-serif;
      backdrop-filter: blur(4px);
      border: 1px solid rgba(255, 255, 255, 0.2);
    `;
    banner.innerHTML = `<i class="fa-solid fa-cloud-slash"></i> Modo Demostración Local Activo (API offline)`;
    document.body.appendChild(banner);
  },

  /**
   * Petición GET
   */
  async get(endpoint) {
    await apiConfigReady;
    if (useLocalMock) return this.mockRequest('GET', endpoint);

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      if (!allowOfflineMock) throw error;
      console.warn('API Offline. Cambiando a Simulación Local en navegador...', error.message);
      useLocalMock = true;
      this.showOfflineBanner();
      return this.mockRequest('GET', endpoint);
    }
  },

  /**
   * Petición POST
   */
  async post(endpoint, body = {}) {
    await apiConfigReady;
    if (useLocalMock) return this.mockRequest('POST', endpoint, body);

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body)
      });
      return await this.handleResponse(response);
    } catch (error) {
      if (!allowOfflineMock) throw error;
      console.warn('API Offline. Cambiando a Simulación Local en navegador...', error.message);
      useLocalMock = true;
      this.showOfflineBanner();
      return this.mockRequest('POST', endpoint, body);
    }
  },

  /**
   * Petición PUT
   */
  async put(endpoint, body = {}) {
    await apiConfigReady;
    if (useLocalMock) return this.mockRequest('PUT', endpoint, body);

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(body)
      });
      return await this.handleResponse(response);
    } catch (error) {
      if (!allowOfflineMock) throw error;
      console.warn('API Offline. Cambiando a Simulación Local en navegador...', error.message);
      useLocalMock = true;
      this.showOfflineBanner();
      return this.mockRequest('PUT', endpoint, body);
    }
  },

  /**
   * Petición DELETE
   */
  async delete(endpoint) {
    await apiConfigReady;
    if (useLocalMock) return this.mockRequest('DELETE', endpoint);

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      if (!allowOfflineMock) throw error;
      console.warn('API Offline. Cambiando a Simulación Local en navegador...', error.message);
      useLocalMock = true;
      this.showOfflineBanner();
      return this.mockRequest('DELETE', endpoint);
    }
  },

  // ==========================================================================
  // Motor de Simulación Local (LocalStorage Endpoint Mocking)
  // ==========================================================================
  mockRequest(method, endpoint, body = {}) {
    return new Promise((resolve, reject) => {
      // Pequeña latencia de red simulada
      setTimeout(() => {
        const loggedUser = JSON.parse(localStorage.getItem('aero_user') || 'null');
        
        try {
          // --- RUTAS PÚBLICAS DE PRODUCTOS ---
          if (method === 'GET' && endpoint.startsWith('/products')) {
            const products = MockDB.get('products');
            const categories = MockDB.get('categories');

            if (endpoint === '/products' || endpoint.startsWith('/products?')) {
              // Parsear query params básicos
              const urlObj = new URL(`http://localhost${endpoint}`);
              const cat = urlObj.searchParams.get('category');
              const search = urlObj.searchParams.get('search');
              
              let filtered = [...products];
              if (cat) {
                const targetCat = categories.find(c => c.slug === cat || c.id == cat);
                if (targetCat) filtered = filtered.filter(p => p.category_id === targetCat.id);
              }
              if (search) {
                const q = search.toLowerCase();
                filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
              }
              return resolve(filtered);
            }

            // ID Individual
            const parts = endpoint.split('/');
            const id = parseInt(parts[2]);
            const prod = products.find(p => p.id === id);
            if (!prod) return reject(new Error('Producto no encontrado'));
            return resolve(prod);
          }

          if (method === 'GET' && endpoint === '/categories') {
            return resolve(MockDB.get('categories'));
          }

          // --- RUTAS DE AUTENTICACIÓN ---
          if (method === 'POST' && endpoint === '/auth/register') {
            const users = MockDB.get('users');
            const email = body.email.toLowerCase();

            if (users.find(u => u.email === email)) {
              return reject(new Error('El correo electrónico ya está registrado'));
            }

            const newUser = {
              id: users.length + 1,
              email,
              full_name: body.fullName,
              password_hash: mockPasswordHash(body.password || ''),
              role: 'client',
              auth_provider: 'email',
              created_at: new Date().toISOString()
            };
            users.push(newUser);
            MockDB.save('users', users);

            return resolve({
              message: 'Usuario registrado exitosamente (Simulación)',
              token: 'mock-jwt-token-' + Math.random().toString(),
              user: newUser
            });
          }

          if (method === 'POST' && endpoint === '/auth/login') {
            const users = MockDB.get('users');
            const email = body.email.toLowerCase();
            const passwordHash = mockPasswordHash(body.password || '');
            const user = users.find(u => u.email === email && u.password_hash === passwordHash);

            if (!user) return reject(new Error('Credenciales inválidas'));

            return resolve({
              message: 'Inicio de sesión exitoso (Simulación)',
              token: 'mock-jwt-token-' + Math.random().toString(),
              user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, auth_provider: user.auth_provider }
            });
          }

          if (method === 'POST' && endpoint === '/auth/oauth') {
            const users = MockDB.get('users');
            const email = body.email.toLowerCase();
            let user = users.find(u => u.email === email);

            if (!user) {
              user = {
                id: users.length + 1,
                email,
                full_name: body.fullName,
                role: 'client',
                auth_provider: body.provider,
                created_at: new Date().toISOString()
              };
              users.push(user);
              MockDB.save('users', users);
            }
            return resolve({
              message: `Inicio de sesión con ${body.provider} exitoso (Simulación)`,
              token: 'mock-jwt-token-' + Math.random().toString(),
              user
            });
          }

          // --- STRIPE PAYMENT INTENT (MOCK cuando offline) ---
          if (method === 'POST' && endpoint === '/payments/create-intent') {
            const amount = body.amount || 1000;
            const fakeId = 'pi_mock_' + Math.random().toString(36).substring(2, 18);
            return resolve({
              success: true,
              paymentIntentId: fakeId,
              clientSecret: fakeId + '_secret_mock',
              amount,
              currency: body.currency || 'cop',
              status: 'requires_payment_method'
            });
          }

          // --- COMPROBACIÓN DE CUPONES ---
          if (method === 'POST' && endpoint === '/orders/coupons/validate') {
            const coupons = MockDB.get('coupons');
            const code = body.code.toUpperCase();
            const coupon = coupons.find(c => c.code === code);

            if (!coupon) return reject(new Error('El cupón ingresado no existe'));
            if (coupon.active !== 1) return reject(new Error('El cupón se encuentra inactivo'));
            if (body.orderTotal < coupon.min_order_value) {
              return reject(new Error(`La compra mínima debe ser de $${coupon.min_order_value}`));
            }

            return resolve({ isValid: true, coupon });
          }

          // --- CREACIÓN DE PEDIDOS (CON STOCK LOCK Y PAGOS SIMULADOS) ---
          if (method === 'POST' && endpoint === '/orders') {
            if (!loggedUser) return reject(new Error('Acceso no autorizado'));
            
            const products = MockDB.get('products');
            const orders = MockDB.get('orders');
            const notifications = MockDB.get('notifications');

            let totalAmount = 0;
            const orderItems = [];

            // Validar stock
            for (const item of body.items) {
              const prod = products.find(p => p.id === item.productId);
              if (!prod) return reject(new Error(`Producto ID ${item.productId} no existe`));
              if (prod.stock < item.quantity) {
                return reject(new Error(`Stock insuficiente para ${prod.name}. Quedan ${prod.stock}.`));
              }
              const itemTotal = prod.price * item.quantity;
              totalAmount += itemTotal;
              orderItems.push({
                product_id: prod.id,
                product_name: prod.name,
                image_url: prod.image_url,
                quantity: item.quantity,
                unit_price: prod.price,
                total_price: itemTotal
              });
            }

            // Aplicar descuento
            let discountAmount = 0;
            if (body.couponCode) {
              const coupons = MockDB.get('coupons');
              const coup = coupons.find(c => c.code === body.couponCode.toUpperCase());
              if (coup && totalAmount >= coup.min_order_value) {
                if (coup.discount_type === 'percentage') {
                  discountAmount = (totalAmount * coup.discount_value) / 100;
                } else if (coup.discount_type === 'fixed') {
                  discountAmount = coup.discount_value;
                }
                discountAmount = Math.min(discountAmount, totalAmount);
              }
            }

            const finalAmount = totalAmount - discountAmount;
            const newOrderId = orders.length + 1;
            const trackingNumber = 'TRK-' + Math.random().toString(36).substring(2, 9).toUpperCase();

            // Bloquear stock restándolo
            for (const item of body.items) {
              const prod = products.find(p => p.id === item.productId);
              prod.stock -= item.quantity;
            }
            MockDB.save('products', products);

            // Simular Pasarela de Pago
            const cardNum = body.paymentDetails.cardNumber || '';
            const otpCode = body.paymentDetails.otpCode || '';
            const bankName = body.paymentDetails.bankName || '';

            if (cardNum.endsWith('9999') || otpCode === '0000' || bankName.includes('Rechazo')) {
              // FALLÓ EL PAGO: Revertir stock
              for (const item of body.items) {
                const prod = products.find(p => p.id === item.productId);
                prod.stock += item.quantity;
              }
              MockDB.save('products', products);

              // Registrar pedido cancelado
              const failedOrder = {
                id: newOrderId,
                user_id: loggedUser.id,
                status: 'cancelled',
                total_amount: totalAmount,
                discount_amount: discountAmount,
                final_amount: finalAmount,
                payment_method: body.paymentMethod,
                payment_status: 'failed',
                tracking_number: trackingNumber,
                created_at: new Date().toISOString()
              };
              orders.push(failedOrder);
              MockDB.save('orders', orders);

              // Notificar
              notifications.push({
                id: notifications.length + 1,
                user_id: loggedUser.id,
                message: `El pago de tu pedido #${newOrderId} fue rechazado. El inventario ha sido liberado.`,
                is_read: 0,
                type: 'order_status',
                created_at: new Date().toISOString()
              });
              MockDB.save('notifications', notifications);

              return reject(new Error('Pago declinado por fondos insuficientes o rechazo bancario. El pedido fue cancelado.'));
            }

            // PAGO EXITOSO
            const successOrder = {
              id: newOrderId,
              user_id: loggedUser.id,
              status: 'paid',
              total_amount: totalAmount,
              discount_amount: discountAmount,
              final_amount: finalAmount,
              payment_method: body.paymentMethod,
              payment_status: 'completed',
              tracking_number: trackingNumber,
              created_at: new Date().toISOString(),
              items: orderItems
            };

            orders.push(successOrder);
            MockDB.save('orders', orders);

            notifications.push({
              id: notifications.length + 1,
              user_id: loggedUser.id,
              message: `¡Tu pago de $${finalAmount.toLocaleString('es-CO')} ha sido aprobado! Tu código de seguimiento es ${trackingNumber}.`,
              is_read: 0,
              type: 'order_status',
              created_at: new Date().toISOString()
            });
            MockDB.save('notifications', notifications);

            return resolve({
              message: 'Pedido simulado creado con éxito',
              orderId: newOrderId,
              trackingNumber,
              totalAmount,
              discountAmount,
              finalAmount,
              status: 'paid',
              paymentStatus: 'completed'
            });
          }

          // --- LISTAR PEDIDOS DE CLIENTE ---
          if (method === 'GET' && endpoint === '/orders/my-orders') {
            if (!loggedUser) return reject(new Error('Acceso no autorizado'));
            const orders = MockDB.get('orders');
            const myOrders = orders.filter(o => o.user_id === loggedUser.id);
            return resolve(myOrders);
          }

          // --- OBTENER DETALLE DE PEDIDO ---
          // Soporte rápido para status de pago (mock)
          if (method === 'GET' && endpoint.startsWith('/payments/status/')) {
            const piId = endpoint.split('/').pop();
            return resolve({ success: true, paymentIntent: { id: piId, status: 'succeeded', amount: 0, currency: 'cop' }, linkedOrder: null });
          }

          if (method === 'GET' && endpoint.startsWith('/orders/')) {
            if (!loggedUser) return reject(new Error('Acceso no autorizado'));
            const id = parseInt(endpoint.split('/')[2]);
            const orders = MockDB.get('orders');
            const order = orders.find(o => o.id === id);

            if (!order) return reject(new Error('Pedido no encontrado'));
            if (order.user_id !== loggedUser.id && loggedUser.role !== 'admin') {
              return reject(new Error('Acceso denegado a este pedido'));
            }

            // Buscar reembolsos vinculados
            const refunds = MockDB.get('refunds');
            const refund = refunds.find(r => r.order_id === id);

            return resolve({
              ...order,
              refund: refund || null
            });
          }

          // --- SOLICITAR REEMBOLSOS (CLIENTE) ---
          if (method === 'POST' && endpoint === '/refunds') {
            if (!loggedUser) return reject(new Error('Acceso no autorizado'));
            
            const orders = MockDB.get('orders');
            const refunds = MockDB.get('refunds');
            const notifications = MockDB.get('notifications');

            const order = orders.find(o => o.id === parseInt(body.orderId));
            if (!order) return reject(new Error('Pedido no encontrado'));
            if (order.user_id !== loggedUser.id) return reject(new Error('Acceso denegado'));

            if (order.status !== 'paid' && order.status !== 'delivered') {
              return reject(new Error('El pedido no es elegible para devolución.'));
            }

            if (refunds.find(r => r.order_id === order.id)) {
              return reject(new Error('Ya existe una solicitud de devolución para este pedido.'));
            }

            // Crear solicitud
            const newRefund = {
              id: refunds.length + 1,
              order_id: order.id,
              reason: body.reason,
              status: 'pending',
              requested_at: new Date().toISOString(),
              admin_notes: null
            };
            refunds.push(newRefund);
            MockDB.save('refunds', refunds);

            // Cambiar estado a refund_requested
            order.status = 'refund_requested';
            MockDB.save('orders', orders);

            // Notificar
            notifications.push({
              id: notifications.length + 1,
              user_id: loggedUser.id,
              message: `Tu solicitud de reembolso para el pedido #${order.id} ha sido registrada y está en revisión.`,
              is_read: 0,
              type: 'refund_status',
              created_at: new Date().toISOString()
            });
            MockDB.save('notifications', notifications);

            return resolve({
              message: 'Solicitud de reembolso enviada con éxito (Simulado)',
              orderId: order.id,
              status: 'refund_requested'
            });
          }

          // --- NOTIFICACIONES ---
          if (method === 'GET' && endpoint === '/notifications') {
            if (!loggedUser) return reject(new Error('Acceso no autorizado'));
            const notifications = MockDB.get('notifications');
            const myNotifs = notifications.filter(n => n.user_id === loggedUser.id);
            return resolve(myNotifs);
          }

          if (method === 'PUT' && endpoint.startsWith('/notifications/') && endpoint.endsWith('/read')) {
            if (!loggedUser) return reject(new Error('Acceso no autorizado'));
            const id = parseInt(endpoint.split('/')[2]);
            const notifications = MockDB.get('notifications');
            const notif = notifications.find(n => n.id === id && n.user_id === loggedUser.id);
            
            if (notif) {
              notif.is_read = 1;
              MockDB.save('notifications', notifications);
              return resolve({ message: 'Leído' });
            }
            return reject(new Error('Notificación no encontrada'));
          }

          // --- RUTAS ADMINISTRATIVAS ---
          if (loggedUser?.role !== 'admin') return reject(new Error('Acceso denegado. Se requiere administrador.'));

          // LISTAR USUARIOS
          if (method === 'GET' && endpoint === '/admin/users') {
            return resolve(MockDB.get('users'));
          }

          // LISTAR REEMBOLSOS
          if (method === 'GET' && endpoint === '/admin/refunds') {
            const refunds = MockDB.get('refunds');
            const orders = MockDB.get('orders');
            const users = MockDB.get('users');

            const fullRefunds = refunds.map(ref => {
              const order = orders.find(o => o.id === ref.order_id);
              const client = users.find(u => u.id === order.user_id);
              return {
                ...ref,
                final_amount: order.final_amount,
                tracking_number: order.tracking_number,
                client_email: client ? client.email : 'desconocido@correo.com',
                client_name: client ? client.full_name : 'Usuario Desconocido'
              };
            });
            return resolve(fullRefunds);
          }

          // LISTAR PEDIDOS
          if (method === 'GET' && endpoint === '/admin/orders') {
            const orders = MockDB.get('orders');
            const users = MockDB.get('users');
            const fullOrders = orders.map(ord => {
              const client = users.find(u => u.id === ord.user_id);
              return {
                ...ord,
                client_email: client ? client.email : 'desconocido',
                client_name: client ? client.full_name : 'Desconocido'
              };
            });
            return resolve(fullOrders);
          }

          // ACTUALIZAR ESTADO PEDIDO (ADMIN)
          if (method === 'PUT' && endpoint.startsWith('/admin/orders/') && endpoint.endsWith('/status')) {
            const id = parseInt(endpoint.split('/')[3]);
            const orders = MockDB.get('orders');
            const order = orders.find(o => o.id === id);
            
            if (!order) return reject(new Error('Pedido no encontrado'));
            
            order.status = body.status;
            MockDB.save('orders', orders);

            // Notificar
            const notifications = MockDB.get('notifications');
            notifications.push({
              id: notifications.length + 1,
              user_id: order.user_id,
              message: `El administrador actualizó tu pedido #${order.id} al estado: ${body.status.toUpperCase()}.`,
              is_read: 0,
              type: 'order_status',
              created_at: new Date().toISOString()
            });
            MockDB.save('notifications', notifications);

            return resolve({ message: 'Estado de pedido actualizado', orderId: id, status: body.status });
          }

          // CREAR PRODUCTO (ADMIN)
          if (method === 'POST' && endpoint === '/admin/products') {
            const products = MockDB.get('products');
            const categories = MockDB.get('categories');
            const cat = categories.find(c => c.id === body.categoryId);

            const newProduct = {
              id: products.length + 1,
              name: body.name,
              description: body.description,
              price: body.price,
              stock: body.stock,
              image_url: body.imageUrl,
              category_id: body.categoryId,
              category_name: cat ? cat.name : 'Varios'
            };
            products.push(newProduct);
            MockDB.save('products', products);

            return resolve({ message: 'Producto creado', product: newProduct });
          }

          // EDITAR PRODUCTO (ADMIN)
          if (method === 'PUT' && endpoint.startsWith('/admin/products/')) {
            const id = parseInt(endpoint.split('/')[3]);
            const products = MockDB.get('products');
            const categories = MockDB.get('categories');
            const prod = products.find(p => p.id === id);

            if (!prod) return reject(new Error('Producto no encontrado'));

            const cat = categories.find(c => c.id === body.categoryId);
            
            prod.name = body.name;
            prod.description = body.description;
            prod.price = body.price;
            prod.stock = body.stock;
            prod.image_url = body.imageUrl;
            prod.category_id = body.categoryId;
            prod.category_name = cat ? cat.name : prod.category_name;

            MockDB.save('products', products);
            return resolve({ message: 'Producto actualizado con éxito', product: prod });
          }

          // ELIMINAR PRODUCTO (ADMIN CON CONTROL DE INTEGRIDAD REVOLUCIONARIO)
          if (method === 'DELETE' && endpoint.startsWith('/admin/products/')) {
            const id = parseInt(endpoint.split('/')[3]);
            const products = MockDB.get('products');
            const orders = MockDB.get('orders');
            
            // Verificar si el producto se encuentra en algún pedido histórico
            // Para la emulación, revisamos si el id está en el campo items de algún order
            let isLinked = false;
            for (const ord of orders) {
              if (ord.items && ord.items.find(item => item.product_id === id)) {
                isLinked = true;
                break;
              }
            }

            if (isLinked) {
              return reject(new Error('No se puede eliminar este producto porque está asociado a pedidos históricos de clientes. Considere editar su stock a 0 para desactivarlo.'));
            }

            const updatedProducts = products.filter(p => p.id !== id);
            MockDB.save('products', updatedProducts);
            return resolve({ message: 'Producto eliminado del catálogo' });
          }

          // PROCESAR REEMBOLSO (ADMIN: APROBAR CON RETORNO DE STOCK Y REVERSA FINANCIERA)
          if (method === 'POST' && endpoint.startsWith('/admin/refunds/') && endpoint.endsWith('/process')) {
            const id = parseInt(endpoint.split('/')[3]);
            const refunds = MockDB.get('refunds');
            const orders = MockDB.get('orders');
            const products = MockDB.get('products');
            const notifications = MockDB.get('notifications');

            const ref = refunds.find(r => r.id === id);
            if (!ref) return reject(new Error('Solicitud de reembolso no encontrada'));
            
            const order = orders.find(o => o.id === ref.order_id);
            if (!order) return reject(new Error('Pedido asociado no encontrado'));

            ref.status = body.action === 'approve' ? 'approved' : 'rejected';
            ref.admin_notes = body.adminNotes;
            ref.processed_at = new Date().toISOString();
            MockDB.save('refunds', refunds);

            if (body.action === 'approve') {
              order.status = 'refunded';
              order.payment_status = 'refunded';
              
              // Devolver stock
              if (order.items) {
                for (const item of order.items) {
                  const prod = products.find(p => p.id === item.product_id);
                  if (prod) prod.stock += item.quantity;
                }
                MockDB.save('products', products);
              }

              notifications.push({
                id: notifications.length + 1,
                user_id: order.user_id,
                message: `¡Tu reembolso para el pedido #${order.id} ha sido aprobado! El valor de $${order.final_amount.toLocaleString('es-CO')} ha sido reversado.`,
                is_read: 0,
                type: 'refund_status',
                created_at: new Date().toISOString()
              });
            } else {
              order.status = 'paid'; // Devuelve al estado pagado original
              notifications.push({
                id: notifications.length + 1,
                user_id: order.user_id,
                message: `Tu solicitud de reembolso para el pedido #${order.id} fue rechazada. Notas: ${body.adminNotes}`,
                is_read: 0,
                type: 'refund_status',
                created_at: new Date().toISOString()
              });
            }

            MockDB.save('orders', orders);
            MockDB.save('notifications', notifications);

            return resolve({
              message: `Reembolso ${body.action === 'approve' ? 'aprobado' : 'rechazado'} con éxito.`,
              refundId: id,
              orderId: order.id,
              status: ref.status,
              orderStatus: order.status
            });
          }

          return reject(new Error(`Endpoint ${method} ${endpoint} no soportado en emulación local`));
        } catch (e) {
          return reject(e);
        }
      }, 300);
    });
  }
};
