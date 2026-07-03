/**
 * AeroShop Frontend Controller & SPA Router
 */

// Estado Global de la Aplicación
const AppState = {
  cart: [],
  appliedCoupon: null,
  activeCheckoutStep: 1,
  currentAdminTab: 'products',
  stripe: null,
  stripePublishableKey: null,
  stripeCardElement: null,
  stripeCardComplete: false
};

// Carga la clave pública de Stripe desde el backend (nunca la secreta)
async function loadStripeConfig() {
  try {
    const cfg = await API.get('/config/public');
    if (cfg && cfg.publishableKey && window.Stripe) {
      AppState.stripePublishableKey = cfg.publishableKey;
      AppState.stripe = window.Stripe(cfg.publishableKey);
      const mode = (cfg.environment === 'production') ? 'live' : 'sandbox';
      console.log(`[Stripe] Inicializado con clave pública (${mode}).`);
    }
  } catch (e) {
    console.warn('[Stripe] No se pudo cargar configuración pública. Usando simulación para métodos no-tarjeta.');
  }
}

function destroyStripeCardElement() {
  if (AppState.stripeCardElement) {
    try {
      AppState.stripeCardElement.unmount();
      AppState.stripeCardElement.destroy();
    } catch (_) { /* ignorar si ya fue destruido */ }
    AppState.stripeCardElement = null;
  }
  AppState.stripeCardComplete = false;
}

function mountStripeCardElement() {
  if (!AppState.stripe) return null;

  const container = document.getElementById('stripe-card-element');
  if (!container) return null;

  destroyStripeCardElement();
  container.innerHTML = '';

  const elements = AppState.stripe.elements({ locale: 'es' });
  const cardElement = elements.create('card', {
    style: typeof ThemeManager !== 'undefined'
      ? ThemeManager.getStripeElementStyle()
      : {
          base: {
            color: '#e2e8f0',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '16px',
            '::placeholder': { color: '#64748b' }
          },
          invalid: { color: '#f472b6' }
        }
  });

  const errorEl = document.getElementById('stripe-card-errors');
  const cardNumDisplay = document.getElementById('card-num-display');
  const cardExpiryDisplay = document.getElementById('card-expiry-display');
  const cardCvvDisplay = document.getElementById('card-cvv-display');
  const card3d = document.getElementById('card-3d-widget');

  cardElement.on('change', (event) => {
    AppState.stripeCardComplete = event.complete;
    if (errorEl) errorEl.textContent = event.error ? event.error.message : '';

    if (cardNumDisplay) {
      const brand = event.brand && event.brand !== 'unknown' ? event.brand.toUpperCase() : '••••';
      cardNumDisplay.textContent = event.empty ? '•••• •••• •••• ••••' : `${brand} •••• •••• ••••`;
    }
    if (cardExpiryDisplay && event.empty) cardExpiryDisplay.textContent = 'MM/AA';
    if (cardCvvDisplay && event.empty) cardCvvDisplay.textContent = '•••';
    if (card3d && event.empty) card3d.classList.remove('flipped');
  });

  cardElement.on('focus', () => {
    if (card3d) card3d.classList.add('flipped');
  });
  cardElement.on('blur', () => {
    if (card3d) card3d.classList.remove('flipped');
  });

  cardElement.mount('#stripe-card-element');
  AppState.stripeCardElement = cardElement;
  return cardElement;
}

// ==========================================================================
// 1. Toast Notifications Utility
// ==========================================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'fa-circle-info';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-triangle-exclamation';

  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  // El toast se auto-remueve en 5 segundos (coordinado con la animación CSS)
  setTimeout(() => {
    toast.remove();
  }, 5000);
}

// ==========================================================================
// 2. Gestión del Carrito de Compras
// ==========================================================================
const CartManager = {
  init() {
    const savedCart = localStorage.getItem('aero_cart');
    if (savedCart) {
      try {
        AppState.cart = JSON.parse(savedCart);
      } catch (e) {
        AppState.cart = [];
      }
    }
    this.updateUI();
  },

  save() {
    localStorage.setItem('aero_cart', JSON.stringify(AppState.cart));
    this.updateUI();
  },

  getCartItems() {
    return AppState.cart;
  },

  addToCart(product, quantity = 1) {
    const existing = AppState.cart.find(item => item.productId === product.id);
    const qty = parseInt(quantity);
    
    if (existing) {
      if (existing.quantity + qty > product.stock) {
        showToast(`Lo sentimos, solo quedan ${product.stock} unidades en inventario.`, 'error');
        return;
      }
      existing.quantity += qty;
    } else {
      AppState.cart.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
        quantity: qty,
        stockLimit: product.stock
      });
    }
    this.save();
    showToast(`"${product.name}" añadido al carrito`, 'success');
  },

  removeFromCart(productId) {
    AppState.cart = AppState.cart.filter(item => item.productId !== productId);
    this.save();
    showToast('Producto eliminado del carrito', 'info');
  },

  updateQuantity(productId, newQty) {
    const item = AppState.cart.find(i => i.productId === productId);
    if (item) {
      const qty = parseInt(newQty);
      if (qty <= 0) {
        this.removeFromCart(productId);
        return;
      }
      if (qty > item.stockLimit) {
        showToast(`Stock máximo alcanzado (${item.stockLimit} unidades disponibles)`, 'error');
        item.quantity = item.stockLimit;
      } else {
        item.quantity = qty;
      }
      this.save();
    }
  },

  clear() {
    AppState.cart = [];
    AppState.appliedCoupon = null;
    this.save();
  },

  calculateTotals() {
    const subtotal = AppState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let discount = 0;

    if (AppState.appliedCoupon) {
      const coup = AppState.appliedCoupon;
      if (subtotal >= coup.min_order_value) {
        if (coup.discount_type === 'percentage') {
          discount = (subtotal * coup.discount_value) / 100;
        } else if (coup.discount_type === 'fixed') {
          discount = coup.discount_value;
        }
        discount = Math.min(discount, subtotal);
      } else {
        // El subtotal bajó del mínimo por remociones
        AppState.appliedCoupon = null;
        showToast('El cupón se desactivó por no cumplir el valor de compra mínimo.', 'warning');
      }
    }

    const total = subtotal - discount;

    return { subtotal, discount, total };
  },

  updateUI() {
    // Actualizar badge de la barra de navegación
    const totalQty = AppState.cart.reduce((sum, item) => sum + item.quantity, 0);
    const badge = document.getElementById('cart-count');
    if (badge) {
      badge.textContent = totalQty;
      badge.style.display = totalQty > 0 ? 'flex' : 'none';
    }

    // Renderizar items del drawer lateral
    const container = document.getElementById('cart-items-container');
    const summarySection = document.getElementById('cart-summary-section');
    if (!container) return;

    if (AppState.cart.length === 0) {
      container.innerHTML = `
        <div class="cart-empty-state">
          <i class="fa-solid fa-cart-shopping"></i>
          <p>Tu carrito está vacío</p>
          <button class="btn btn-primary btn-sm" id="cart-back-to-shop-btn">Comenzar a Comprar</button>
        </div>
      `;
      if (summarySection) summarySection.style.display = 'none';
      return;
    }

    let itemsHtml = AppState.cart.map(item => `
      <div class="cart-item">
        <img src="${sanitizeUrl(item.image_url)}" alt="${escapeHtml(item.name)}" class="cart-item-img">
        <div class="cart-item-details">
          <h4 class="cart-item-title">${escapeHtml(item.name)}</h4>
          <div class="cart-item-price-row">
            <div class="qty-selector" style="border-radius: 4px;">
              <button class="qty-btn drawer-qty-minus" data-id="${item.productId}" style="width:24px; height:24px; font-size:0.75rem;"><i class="fa-solid fa-minus"></i></button>
              <input type="number" class="qty-input drawer-qty-input" data-id="${item.productId}" value="${item.quantity}" style="width:30px; height:24px; font-size:0.85rem;" readonly>
              <button class="qty-btn drawer-qty-plus" data-id="${item.productId}" style="width:24px; height:24px; font-size:0.75rem;"><i class="fa-solid fa-plus"></i></button>
            </div>
            <span class="cart-item-price">${Views.formatCurrency(item.price * item.quantity)}</span>
            <button class="remove-cart-item drawer-item-remove" data-id="${item.productId}"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      </div>
    `).join('');

    container.innerHTML = itemsHtml;
    
    // Totales
    const { subtotal, discount, total } = this.calculateTotals();
    
    const subtotalEl = document.getElementById('cart-subtotal');
    const discountEl = document.getElementById('cart-discount');
    const discountRow = document.getElementById('cart-discount-row');
    const totalEl = document.getElementById('cart-total');
    const couponMsg = document.getElementById('coupon-message');

    if (subtotalEl) subtotalEl.textContent = Views.formatCurrency(subtotal);
    if (totalEl) totalEl.textContent = Views.formatCurrency(total);

    if (discountEl && discountRow) {
      if (discount > 0) {
        discountEl.textContent = `-${Views.formatCurrency(discount)}`;
        discountRow.style.display = 'flex';
        if (couponMsg && AppState.appliedCoupon) {
          couponMsg.className = 'coupon-msg success';
          couponMsg.textContent = `Cupón ${AppState.appliedCoupon.code} aplicado con éxito.`;
        }
      } else {
        discountRow.style.display = 'none';
        if (couponMsg && !AppState.appliedCoupon) {
          couponMsg.textContent = '';
        }
      }
    }

    if (summarySection) summarySection.style.display = 'block';
  }
};

// ==========================================================================
// 3. Sistema de Notificaciones
// ==========================================================================
const NotificationManager = {
  intervalId: null,

  startPolling() {
    if (!Auth.isAuthenticated()) return;
    this.fetchNotifications();
    // Encuestar notificaciones cada 30 segundos
    this.intervalId = setInterval(() => {
      this.fetchNotifications();
    }, 30000);
  },

  stopPolling() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  },

  async fetchNotifications() {
    try {
      const notifications = await API.get('/notifications');
      this.renderNotifications(notifications);
    } catch (e) {
      console.warn('Error al obtener notificaciones:', e.message);
    }
  },

  renderNotifications(notifications) {
    const listContainer = document.getElementById('notif-list-items');
    const badge = document.getElementById('notif-count');
    
    if (!listContainer) return;

    const unreadCount = notifications.filter(n => n.is_read === 0).length;
    
    if (badge) {
      badge.textContent = unreadCount;
      badge.style.display = unreadCount > 0 ? 'flex' : 'none';
    }

    if (notifications.length === 0) {
      listContainer.innerHTML = `<div class="notif-empty">No tienes notificaciones.</div>`;
      return;
    }

    listContainer.innerHTML = notifications.map(notif => {
      const date = new Date(notif.created_at).toLocaleDateString('es-CO', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      return `
        <div class="notif-item ${notif.is_read === 0 ? 'unread' : ''}" data-id="${notif.id}">
          <p>${escapeHtml(notif.message)}</p>
          <span class="notif-time"><i class="fa-regular fa-clock"></i> ${date}</span>
        </div>
      `;
    }).join('');
  },

  async markAsRead(id) {
    try {
      await API.put(`/notifications/${id}/read`);
      this.fetchNotifications();
    } catch (e) {
      console.error(e);
    }
  }
};

// ==========================================================================
// 4. SPA Router
// ==========================================================================
function setAuthLayout(active) {
  const mainEl = document.querySelector('.main-content');
  if (mainEl) {
    mainEl.classList.toggle('main-content--auth', active);
  }
}

function showAuthError(elementId, message) {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.hidden = false;
  } else {
    el.textContent = '';
    el.hidden = true;
  }
}

function setOAuthLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.setAttribute('aria-busy', loading ? 'true' : 'false');
  if (loading) btn.dataset.originalText = btn.querySelector('.btn-oauth__text')?.textContent || '';
  const textEl = btn.querySelector('.btn-oauth__text');
  if (textEl && loading) textEl.textContent = 'Conectando...';
  else if (textEl && btn.dataset.originalText) textEl.textContent = btn.dataset.originalText;
}

async function router() {
  const hash = window.location.hash || '#';
  const appContainer = document.getElementById('app');
  
  if (!appContainer) return;

  const isAuthRoute = hash === '#login' || hash === '#register';
  setAuthLayout(isAuthRoute);

  // Mostrar Spinner
  appContainer.innerHTML = `
    <div class="loading-spinner">
      <div class="spinner"></div>
      <p>Cargando información...</p>
    </div>
  `;

  try {
    // RUTA: Home (Catálogo)
    if (hash === '#' || hash === '') {
      const products = await API.get('/products');
      const categories = await API.get('/categories');
      appContainer.innerHTML = Views.Home(products, categories);
      setupHomeEvents();
      return;
    }

    // RUTA: Producto Detalle
    if (hash.startsWith('#product/')) {
      const id = hash.split('/')[1];
      const product = await API.get(`/products/${id}`);
      appContainer.innerHTML = Views.ProductDetail(product);
      setupDetailEvents(product);
      return;
    }

    // RUTA: Iniciar Sesión
    if (hash === '#login') {
      if (Auth.isAuthenticated()) {
        window.location.hash = '#';
        return;
      }
      appContainer.innerHTML = Views.Login();
      setupLoginEvents();
      return;
    }

    // RUTA: Registro
    if (hash === '#register') {
      if (Auth.isAuthenticated()) {
        window.location.hash = '#';
        return;
      }
      appContainer.innerHTML = Views.Register();
      setupRegisterEvents();
      return;
    }

    // RUTA: Checkout (Compra)
    if (hash === '#checkout') {
      if (!Auth.isAuthenticated()) {
        showToast('Debes iniciar sesión para realizar la compra.', 'info');
        window.location.hash = '#login';
        return;
      }
      const items = CartManager.getCartItems();
      const { subtotal, discount, total } = CartManager.calculateTotals();
      const user = Auth.getUser();
      
      AppState.activeCheckoutStep = 1;
      appContainer.innerHTML = Views.Checkout(items, subtotal, discount, total, 1, user);
      await loadStripeConfig();
      setupCheckoutEvents();
      return;
    }

    // RUTA: Historial de Pedidos
    if (hash === '#orders') {
      if (!Auth.isAuthenticated()) {
        window.location.hash = '#login';
        return;
      }
      const orders = await API.get('/orders/my-orders');
      appContainer.innerHTML = Views.Orders(orders);
      return;
    }

    // RUTA: Detalle de Pedido
    if (hash.startsWith('#orders/')) {
      if (!Auth.isAuthenticated()) {
        window.location.hash = '#login';
        return;
      }
      const id = hash.split('/')[1];
      const order = await API.get(`/orders/${id}`);
      appContainer.innerHTML = Views.OrderDetail(order);
      setupOrderDetailEvents();
      return;
    }

    // RUTA: Panel de Administración
    if (hash.startsWith('#admin')) {
      if (!Auth.isAdmin()) {
        showToast('Acceso denegado. Se requieren permisos de administrador.', 'error');
        window.location.hash = '#';
        return;
      }
      
      // Cargar información según pestaña activa
      const tab = hash.split('/')[1] || 'products';
      AppState.currentAdminTab = tab;
      
      let data = [];
      if (tab === 'products') data = await API.get('/products');
      else if (tab === 'orders') data = await API.get('/admin/orders');
      else if (tab === 'refunds') data = await API.get('/admin/refunds');
      else if (tab === 'users') data = await API.get('/admin/users');

      appContainer.innerHTML = Views.Admin(tab, data);
      setupAdminEvents(tab);
      return;
    }

    // Ruta 404
    appContainer.innerHTML = `
      <div class="catalog-empty card glass">
        <i class="fa-solid fa-triangle-exclamation" style="color: var(--warning);"></i>
        <h2>Página no encontrada (404)</h2>
        <p>El enlace que seguiste no existe o ha sido movido.</p>
        <a href="#" class="btn btn-primary" style="margin-top: 20px;">Volver al Catálogo</a>
      </div>
    `;

  } catch (error) {
    console.error('Routing error:', error);
    appContainer.innerHTML = `
      <div class="catalog-empty card glass">
        <i class="fa-solid fa-circle-exclamation" style="color: var(--danger);"></i>
        <h2>Error al cargar la página</h2>
        <p>${error.message || 'Compruebe la conexión con el servidor API.'}</p>
        <a href="#" class="btn btn-primary" style="margin-top: 20px;">Reintentar</a>
      </div>
    `;
  }
}

// ==========================================================================
// 5. Configuración de Eventos de Vistas
// ==========================================================================

// --- Vista Catálogo ---
function setupHomeEvents() {
  const searchInput = document.getElementById('search-input');
  const catFilter = document.getElementById('category-filter');

  // Búsqueda en tiempo real con retraso (debounce)
  let debounceTimeout;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(async () => {
        const products = await API.get(`/products?category=${catFilter.value}&search=${e.target.value}`);
        const categories = await API.get('/categories');
        
        // Mantener el foco
        const grid = document.querySelector('.products-grid');
        if (grid) {
          const items = products.map(prod => {
            const isOutOfStock = prod.stock <= 0;
            return `
              <div class="card product-card" data-id="${prod.id}">
                <div class="product-img-container">
                  <img src="${prod.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500'}" alt="${prod.name}" class="product-img">
                  <span class="category-badge">${prod.category_name}</span>
                  ${isOutOfStock ? `<div class="stock-out-badge">Agotado</div>` : ''}
                </div>
                <div class="product-info">
                  <h3 class="product-title">${prod.name}</h3>
                  <p class="product-desc">${prod.description || 'Sin descripción disponible.'}</p>
                  <div class="product-price-action">
                    <span class="product-price">${Views.formatCurrency(prod.price)}</span>
                    <button class="btn btn-primary btn-sm btn-add-to-cart-quick" data-id="${prod.id}" ${isOutOfStock ? 'disabled' : ''}>
                      <i class="fa-solid fa-cart-plus"></i>
                    </button>
                  </div>
                </div>
              </div>
            `;
          }).join('');
          grid.innerHTML = items || `
            <div class="catalog-empty card glass" style="grid-column: 1/-1;">
              <i class="fa-solid fa-face-frown"></i>
              <h2>No se encontraron productos</h2>
            </div>
          `;
        }
      }, 300);
    });
  }

  // Filtro de categorías
  if (catFilter) {
    catFilter.addEventListener('change', async (e) => {
      const q = searchInput ? searchInput.value : '';
      const products = await API.get(`/products?category=${e.target.value}&search=${q}`);
      const grid = document.querySelector('.products-grid');
      if (grid) {
        grid.innerHTML = products.map(prod => {
          const isOutOfStock = prod.stock <= 0;
          return `
            <div class="card product-card" data-id="${prod.id}">
              <div class="product-img-container">
                <img src="${prod.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500'}" alt="${prod.name}" class="product-img">
                <span class="category-badge">${prod.category_name}</span>
                ${isOutOfStock ? `<div class="stock-out-badge">Agotado</div>` : ''}
              </div>
              <div class="product-info">
                <h3 class="product-title">${prod.name}</h3>
                <p class="product-desc">${prod.description || 'Sin descripción disponible.'}</p>
                <div class="product-price-action">
                  <span class="product-price">${Views.formatCurrency(prod.price)}</span>
                  <button class="btn btn-primary btn-sm btn-add-to-cart-quick" data-id="${prod.id}" ${isOutOfStock ? 'disabled' : ''}>
                    <i class="fa-solid fa-cart-plus"></i>
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('') || `<div class="catalog-empty card glass" style="grid-column: 1/-1;"><i class="fa-solid fa-face-frown"></i><h2>No hay productos</h2></div>`;
      }
    });
  }

  // Clic en tarjetas (Navegar a detalle) y agregar rápido al carrito
  const grid = document.querySelector('.products-grid');
  if (grid) {
    grid.addEventListener('click', async (e) => {
      const card = e.target.closest('.product-card');
      const quickAddBtn = e.target.closest('.btn-add-to-cart-quick');
      
      if (quickAddBtn) {
        e.stopPropagation();
        const prodId = quickAddBtn.getAttribute('data-id');
        try {
          const product = await API.get(`/products/${prodId}`);
          CartManager.addToCart(product, 1);
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      if (card) {
        const id = card.getAttribute('data-id');
        window.location.hash = `#product/${id}`;
      }
    });
  }
}

// --- Vista Detalle ---
function setupDetailEvents(product) {
  const qtyMinus = document.getElementById('qty-minus');
  const qtyPlus = document.getElementById('qty-plus');
  const qtyInput = document.getElementById('detail-qty');
  const addBtn = document.getElementById('btn-add-to-cart-detail');

  if (qtyMinus && qtyPlus && qtyInput) {
    qtyMinus.addEventListener('click', () => {
      const val = parseInt(qtyInput.value);
      if (val > 1) qtyInput.value = val - 1;
    });

    qtyPlus.addEventListener('click', () => {
      const val = parseInt(qtyInput.value);
      if (val < product.stock) qtyInput.value = val + 1;
      else showToast(`Límite de stock disponible alcanzado (${product.stock} unidades)`, 'warning');
    });
  }

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const qty = qtyInput ? parseInt(qtyInput.value) : 1;
      CartManager.addToCart(product, qty);
    });
  }
}

// --- Vista Login ---
async function handleOAuthLogin(provider, btn) {
  showAuthError('login-error', '');
  setOAuthLoading(btn, true);
  try {
    const mockUser = provider === 'google'
      ? { provider: 'google', email: 'google-user@gmail.com', fullName: 'Google User Test', providerId: 'google-123456789' }
      : { provider: 'apple', email: 'apple-client@icloud.com', fullName: 'Apple Customer Test', providerId: 'apple-987654321' };
    const res = await API.post('/auth/oauth', mockUser);
    Auth.setSession(res.token, res.user);
    showToast(res.message, 'success');
    window.location.hash = '#';
  } catch (err) {
    const msg = err.message || 'No se pudo iniciar sesión con el proveedor seleccionado.';
    showAuthError('login-error', msg);
    showToast(msg, 'error');
  } finally {
    setOAuthLoading(btn, false);
  }
}

function setupLoginEvents() {
  const form = document.getElementById('login-form');
  const googleBtn = document.getElementById('btn-google-login');
  const appleBtn = document.getElementById('btn-apple-login');
  const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      showAuthError('login-error', '');
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      if (!email || !password) {
        showAuthError('login-error', 'Completa correo y contraseña.');
        return;
      }

      if (submitBtn) submitBtn.disabled = true;
      try {
        const res = await API.post('/auth/login', { email, password });
        Auth.setSession(res.token, res.user);
        showToast(res.message, 'success');
        window.location.hash = '#';
      } catch (err) {
        const msg = err.message || 'Credenciales incorrectas. Verifica tu correo y contraseña.';
        showAuthError('login-error', msg);
        showToast(msg, 'error');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  if (googleBtn) {
    googleBtn.addEventListener('click', () => handleOAuthLogin('google', googleBtn));
  }

  if (appleBtn) {
    appleBtn.addEventListener('click', () => handleOAuthLogin('apple', appleBtn));
  }
}

// --- Vista Registro ---
function setupRegisterEvents() {
  const form = document.getElementById('register-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullName = document.getElementById('register-name').value;
      const email = document.getElementById('register-email').value;
      const password = document.getElementById('register-password').value;

      showAuthError('register-error', '');
      try {
        const res = await API.post('/auth/register', { email, password, fullName });
        Auth.setSession(res.token, res.user);
        showToast(res.message, 'success');
        window.location.hash = '#';
      } catch (err) {
        const msg = err.message || 'No se pudo crear la cuenta.';
        showAuthError('register-error', msg);
        showToast(msg, 'error');
      }
    });
  }
}

// --- Datos de Departamentos y Municipios ---
const COLOMBIA_DATA = {
  "Amazonas": ["Leticia", "Puerto Nariño"],
  "Antioquia": ["Medellín", "Bello", "Itagüí", "Envigado", "Apartadó", "Rionegro", "Turbo", "Caucasia"],
  "Arauca": ["Arauca", "Saravena", "Tame"],
  "Atlántico": ["Barranquilla", "Soledad", "Malambo", "Sabanalarga", "Puerto Colombia"],
  "Bogotá D.C.": ["Bogotá"],
  "Bolívar": ["Cartagena", "Magangué", "Turbaco", "Arjona", "El Carmen de Bolívar"],
  "Boyacá": ["Tunja", "Duitama", "Sogamoso", "Chiquinquirá", "Puerto Boyacá"],
  "Caldas": ["Manizales", "La Dorada", "Chinchiná", "Villamaría"],
  "Caquetá": ["Florencia", "San Vicente del Caguán"],
  "Casanare": ["Yopal", "Aguazul", "Paz de Ariporo"],
  "Cauca": ["Popayán", "Santander de Quilichao", "Puerto Tejada"],
  "Cesar": ["Valledupar", "Aguachica", "Agustín Codazzi"],
  "Chocó": ["Quibdó", "Istmina", "Tadó"],
  "Córdoba": ["Montería", "Santa Cruz de Lorica", "Sahagún", "Cereté"],
  "Cundinamarca": ["Soacha", "Chía", "Zipaquirá", "Facatativá", "Fusagasugá", "Madrid"],
  "Guainía": ["Inírida"],
  "Guaviare": ["San José del Guaviare"],
  "Huila": ["Neiva", "Pitalito", "Garzón"],
  "La Guajira": ["Riohacha", "Maicao", "Uribia"],
  "Magdalena": ["Santa Marta", "Ciénaga", "Fundación", "El Banco"],
  "Meta": ["Villavicencio", "Acacías", "Granada"],
  "Nariño": ["Pasto", "Tumaco", "Ipiales"],
  "Norte de Santander": ["Cúcuta", "Ocaña", "Villa del Rosario", "Los Patios", "Pamplona"],
  "Putumayo": ["Mocoa", "Puerto Asís", "Valle del Guamuez"],
  "Quindío": ["Armenia", "Calarcá", "Quimbaya"],
  "Risaralda": ["Pereira", "Dosquebradas", "Santa Rosa de Cabal"],
  "San Andrés y Providencia": ["San Andrés", "Providencia"],
  "Santander": ["Bucaramanga", "Floridablanca", "Barrancabermeja", "Girón", "Piedecuesta"],
  "Sucre": ["Sincelejo", "Corozal", "San Marcos"],
  "Tolima": ["Ibagué", "Espinal", "Melgar"],
  "Valle del Cauca": ["Cali", "Buenaventura", "Palmira", "Tuluá", "Yumbo", "Cartago", "Jamundí", "Buga"],
  "Vaupés": ["Mitú"],
  "Vichada": ["Puerto Carreño"]
};

// --- Vista Checkout ---
function setupCheckoutEvents() {
  const stepHeaders = document.querySelectorAll('.checkout-step-header');
  const btnNext1 = document.getElementById('btn-next-step-1');
  const pMethodCards = document.querySelectorAll('.payment-method-card');
  const processBtn = document.getElementById('btn-process-checkout');

  // Lógica de Departamentos / Municipios
  const deptSelect = document.getElementById('shipping-department');
  const citySelect = document.getElementById('shipping-city');

  if (deptSelect && citySelect) {
    // Poblar Departamentos
    Object.keys(COLOMBIA_DATA).forEach(dept => {
      const option = document.createElement('option');
      option.value = dept;
      option.textContent = dept;
      deptSelect.appendChild(option);
    });

    // Manejar cambio de Departamento
    deptSelect.addEventListener('change', () => {
      const selectedDept = deptSelect.value;
      citySelect.innerHTML = '<option value="">Seleccione Municipio...</option>';
      
      if (selectedDept && COLOMBIA_DATA[selectedDept]) {
        citySelect.disabled = false;
        COLOMBIA_DATA[selectedDept].forEach(city => {
          const option = document.createElement('option');
          option.value = city;
          option.textContent = city;
          citySelect.appendChild(option);
        });
      } else {
        citySelect.disabled = true;
      }
    });
  }

  // Permitir colapsar acordeón
  stepHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const stepNum = parseInt(header.getAttribute('data-step'));
      if (stepNum === 2 && AppState.activeCheckoutStep < 2) {
        showToast('Complete el paso 1 de Envío primero.', 'warning');
        return;
      }
      
      const parent = header.closest('.checkout-step');
      const isActive = parent.classList.contains('active');
      
      document.querySelectorAll('.checkout-step').forEach(s => s.classList.remove('active'));
      if (!isActive) {
        parent.classList.add('active');
      }
    });
  });

  // Paso 1 completado
  if (btnNext1) {
    btnNext1.addEventListener('click', () => {
      const name = document.getElementById('shipping-name').value;
      const addr = document.getElementById('shipping-address').value;
      const dept = document.getElementById('shipping-department') ? document.getElementById('shipping-department').value : '';
      const city = document.getElementById('shipping-city').value;

      if (!name || !addr || !city || !dept) {
        showToast('Por favor, rellene todos los campos de envío (incluyendo departamento y ciudad).', 'error');
        return;
      }

      AppState.activeCheckoutStep = 2;
      document.getElementById('step-1-card').classList.remove('active');
      document.getElementById('step-2-card').classList.add('active');
    });
  }

  // Cambio de método de pago
  pMethodCards.forEach(card => {
    card.addEventListener('click', () => {
      pMethodCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');

      const method = card.getAttribute('data-method');
      document.querySelectorAll('.payment-form-details').forEach(form => form.style.display = 'none');
      document.getElementById(`payment-form-${method}`).style.display = 'block';
    });
  });

  // ─────────────────────────────────────────────────────────
  // Stripe Elements (tarjeta segura) vs campos demo locales
  // ─────────────────────────────────────────────────────────
  const isMockStripe = !AppState.stripe || (AppState.stripePublishableKey || '').includes('placeholder');
  const stripeCardFields = document.getElementById('stripe-card-fields');
  const legacyCardFields = document.getElementById('legacy-card-fields');

  if (isMockStripe) {
    if (stripeCardFields) stripeCardFields.style.display = 'none';
    if (legacyCardFields) legacyCardFields.style.display = 'block';
  } else if (stripeCardFields && legacyCardFields) {
    stripeCardFields.style.display = 'block';
    legacyCardFields.style.display = 'none';
    mountStripeCardElement();
  }

  // ─────────────────────────────────────────────────────────
  // Lógica Tarjeta 3D Interactiva
  // ─────────────────────────────────────────────────────────
  const cardNumInput  = document.getElementById('card-number');
  const cardHolderInput = document.getElementById('card-holder');
  const cardExpiryInput = document.getElementById('card-expiry');
  const cardCvvInput  = document.getElementById('card-cvv');
  const card3d        = document.getElementById('card-3d-widget');

  const cardNumDisplay    = document.getElementById('card-num-display');
  const cardHolderDisplay = document.getElementById('card-holder-display');
  const cardExpiryDisplay = document.getElementById('card-expiry-display');
  const cardCvvDisplay    = document.getElementById('card-cvv-display');

  if (cardNumInput && card3d) {
    // Formato automático número: 4444 4444 4444 4444
    cardNumInput.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '').substring(0, 16);
      e.target.value = v.replace(/(.{4})/g, '$1 ').trim();
      const padded = v.padEnd(16, '•');
      cardNumDisplay.textContent =
        padded.substring(0,4) + ' ' + padded.substring(4,8) + ' ' +
        padded.substring(8,12) + ' ' + padded.substring(12,16);
    });

    cardHolderInput.addEventListener('input', (e) => {
      cardHolderDisplay.textContent = e.target.value.toUpperCase() || 'NOMBRE APELLIDO';
    });

    // Formato automático expiración MM/AA
    cardExpiryInput.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '').substring(0, 4);
      if (v.length >= 3) v = v.substring(0,2) + '/' + v.substring(2);
      e.target.value = v;
      cardExpiryDisplay.textContent = v || 'MM/AA';
    });

    // CVV: girar tarjeta al hacer focus
    cardCvvInput.addEventListener('focus', () => card3d.classList.add('flipped'));
    cardCvvInput.addEventListener('blur',  () => card3d.classList.remove('flipped'));
    cardCvvInput.addEventListener('input', (e) => {
      cardCvvDisplay.textContent = e.target.value || '•••';
    });
  }

  // ─────────────────────────────────────────────────────────
  // Modal Animado de Pago
  // ─────────────────────────────────────────────────────────
  function showPaymentModal(state, data = {}) {
    // Eliminar modal anterior si existe
    const existing = document.getElementById('payment-modal-overlay');
    if (existing) existing.remove();

    let html = '';

    if (state === 'processing') {
      html = `
        <div class="payment-modal payment-modal-processing">
          <div class="pm-icon-ring">
            <i class="fa-solid fa-lock"></i>
          </div>
          <div class="pm-title">Procesando Pago</div>
          <div class="pm-subtitle">Conectando con la pasarela de pago segura...<br>No cierres esta ventana.</div>
          <div class="pm-progress-bar"><div class="pm-progress-bar-inner"></div></div>
          <div class="pm-steps-list" id="pm-steps">
            <div class="pm-step" id="pm-s1"><i class="fa-solid fa-circle-dot"></i> Verificando artículos del carrito...</div>
            <div class="pm-step" id="pm-s2"><i class="fa-solid fa-circle-dot"></i> Validando método de pago...</div>
            <div class="pm-step" id="pm-s3"><i class="fa-solid fa-circle-dot"></i> Autorizando transacción...</div>
            <div class="pm-step" id="pm-s4"><i class="fa-solid fa-circle-dot"></i> Confirmando pedido...</div>
          </div>
        </div>`;

      // Simular pasos progresivos
      setTimeout(() => {
        const s1 = document.getElementById('pm-s1');
        if (s1) { s1.classList.add('done'); s1.querySelector('i').className = 'fa-solid fa-circle-check'; }
      }, 500);
      setTimeout(() => {
        const s2 = document.getElementById('pm-s2');
        if (s2) { s2.classList.add('done'); s2.querySelector('i').className = 'fa-solid fa-circle-check'; }
      }, 1000);
      setTimeout(() => {
        const s3 = document.getElementById('pm-s3');
        if (s3) { s3.classList.add('done'); s3.querySelector('i').className = 'fa-solid fa-circle-check'; }
      }, 1800);

    } else if (state === 'success') {
      const amountFormatted = (data.finalAmount || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
      html = `
        <div class="payment-modal payment-modal-success">
          <div class="pm-success-ring"><i class="fa-solid fa-check"></i></div>
          <div class="pm-title" style="color: var(--cyan);">¡Pago Aprobado!</div>
          <div class="pm-amount-display">${amountFormatted}</div>
          <div class="pm-subtitle">Tu pedido ha sido confirmado y está siendo preparado.</div>
          <div class="pm-tracking">
            <i class="fa-solid fa-truck-fast"></i> &nbsp;Tracking: <strong>${data.trackingNumber || ''}</strong>
          </div>
          <button class="btn btn-primary btn-block" id="pm-close-success" style="margin-top: 8px;">
            <i class="fa-solid fa-box-open"></i> Ver Mis Pedidos
          </button>
        </div>`;

    } else if (state === 'failed') {
      html = `
        <div class="payment-modal payment-modal-failed">
          <div class="pm-fail-ring"><i class="fa-solid fa-xmark"></i></div>
          <div class="pm-title" style="color: var(--magenta);">Pago Rechazado</div>
          <div class="pm-error-msg"><i class="fa-solid fa-triangle-exclamation"></i> ${data.message || 'La transacción fue rechazada por la pasarela de pagos.'}</div>
          <div class="pm-subtitle">Puedes intentar con otra tarjeta o método de pago.</div>
          <div style="display: flex; gap: 12px; margin-top: 24px;">
            <button class="btn btn-secondary" id="pm-close-fail" style="flex: 1;">
              <i class="fa-solid fa-arrow-left"></i> Volver
            </button>
            <button class="btn btn-primary" id="pm-retry-fail" style="flex: 1;">
              <i class="fa-solid fa-rotate-right"></i> Reintentar
            </button>
          </div>
        </div>`;
    }

    const overlay = document.createElement('div');
    overlay.id = 'payment-modal-overlay';
    overlay.className = 'payment-modal-overlay';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    // Botón: ir a pedidos (éxito)
    const successBtn = document.getElementById('pm-close-success');
    if (successBtn) {
      successBtn.addEventListener('click', () => {
        overlay.remove();
        window.location.hash = '#orders';
      });
    }

    // Botón: volver al checkout (fallo)
    const failBtn = document.getElementById('pm-close-fail');
    if (failBtn) failBtn.addEventListener('click', () => overlay.remove());

    // Botón: reintentar (fallo)
    const retryBtn = document.getElementById('pm-retry-fail');
    if (retryBtn) retryBtn.addEventListener('click', () => overlay.remove());
  }

  // ─────────────────────────────────────────────────────────
  // Procesar Pedido y Pago (con soporte Stripe real para tarjetas)
  // ─────────────────────────────────────────────────────────
  if (processBtn) {
    processBtn.addEventListener('click', async () => {
      const pCard = document.querySelector('.payment-method-card.selected');
      const method = pCard ? pCard.getAttribute('data-method') : 'card';
      const items = CartManager.getCartItems();
      const couponCode = AppState.appliedCoupon ? AppState.appliedCoupon.code : null;

      const paymentDetails = {};

      const useStripeElement = method === 'card' && AppState.stripe && !(AppState.stripePublishableKey || '').includes('placeholder');

      if (method === 'card') {
        const holderName = document.getElementById('card-holder')
          ? document.getElementById('card-holder').value.trim()
          : '';

        if (!holderName) {
          showToast('Ingrese el nombre del titular de la tarjeta.', 'error');
          return;
        }

        if (useStripeElement) {
          if (!AppState.stripeCardElement || !AppState.stripeCardComplete) {
            showToast('Complete los datos de la tarjeta.', 'error');
            return;
          }
        } else {
          paymentDetails.cardNumber = document.getElementById('card-number').value.replace(/\s+/g, '');
          paymentDetails.expiryDate = document.getElementById('card-expiry').value;
          paymentDetails.cvv = document.getElementById('card-cvv').value;

          if (!paymentDetails.cardNumber || !paymentDetails.expiryDate || !paymentDetails.cvv) {
            showToast('Complete la información de su tarjeta.', 'error');
            return;
          }
        }
      } else if (method === 'pse') {
        paymentDetails.bankName = document.getElementById('pse-bank').value;
        paymentDetails.userDocument = document.getElementById('pse-doc-number').value;

        if (!paymentDetails.bankName || !paymentDetails.userDocument) {
          showToast('Seleccione un banco e introduzca su número de documento.', 'error');
          return;
        }
      } else if (method === 'wallet') {
        paymentDetails.phoneNumber = document.getElementById('wallet-phone').value;
        paymentDetails.otpCode = document.getElementById('wallet-otp').value;

        if (!paymentDetails.phoneNumber || !paymentDetails.otpCode) {
          showToast('Introduzca su celular y el código OTP enviado.', 'error');
          return;
        }
      }

      // Mostrar modal de procesamiento
      processBtn.disabled = true;
      showPaymentModal('processing');

      try {
        let orderPayload = { items, couponCode, paymentMethod: method, paymentDetails };

        // ======================================================
        // FLUJO STRIPE (SOLO TARJETA) - MODO SEGURO
        // ======================================================
        if (method === 'card') {
          // 1. Crear PaymentIntent en el backend (sin tocar datos de tarjeta)
          const { subtotal, discount, total } = CartManager.calculateTotals();
          const intentRes = await API.post('/payments/create-intent', {
            amount: Math.round(total),
            currency: 'cop',
            orderPreview: { itemCount: items.length }
          });

          if (!intentRes.clientSecret || !intentRes.paymentIntentId) {
            throw new Error('No se pudo inicializar el pago con Stripe.');
          }

          const clientSecret = intentRes.clientSecret;
          const paymentIntentId = intentRes.paymentIntentId;

          if (!useStripeElement) {
            // MODO DEMO / placeholder: simulamos confirmación exitosa sin llamar a Stripe.js real
            console.log('[Stripe MOCK] confirmCardPayment simulado para', paymentIntentId);
            if (paymentDetails.cardNumber && paymentDetails.cardNumber.endsWith('9999')) {
              throw new Error('Pago declinado por fondos insuficientes (tarjeta de prueba).');
            }
            await new Promise(r => setTimeout(r, 650));
          } else {
            const holderName = document.getElementById('card-holder')
              ? document.getElementById('card-holder').value.trim()
              : 'Cliente AeroShop';

            const { error: confirmError, paymentIntent } = await AppState.stripe.confirmCardPayment(
              clientSecret,
              {
                payment_method: {
                  card: AppState.stripeCardElement,
                  billing_details: { name: holderName }
                }
              }
            );

            if (confirmError) {
              throw new Error(confirmError.message || 'Pago rechazado por Stripe.');
            }
            if (paymentIntent.status !== 'succeeded') {
              throw new Error(`El pago no fue completado. Estado: ${paymentIntent.status}`);
            }
          }

          // 3. Ahora sí creamos el pedido, pasando el paymentIntentId para verificación en backend
          orderPayload.paymentDetails = {
            ...paymentDetails,
            paymentIntentId: paymentIntentId
          };
        }

        // 4. Crear el pedido (el backend verificará el PI si es tarjeta real)
        const res = await API.post('/orders', orderPayload);

        CartManager.clear();
        NotificationManager.fetchNotifications();

        // Esperar animación
        await new Promise(r => setTimeout(r, 2200));

        const procModal = document.getElementById('payment-modal-overlay');
        if (procModal) procModal.remove();

        showPaymentModal('success', {
          orderId: res.orderId,
          trackingNumber: res.trackingNumber,
          finalAmount: res.finalAmount
        });

        const appContainer = document.getElementById('app');
        if (appContainer) {
          appContainer.innerHTML = Views.CheckoutSuccess(res.orderId, res.trackingNumber, res.finalAmount);
        }

      } catch (err) {
        await new Promise(r => setTimeout(r, 2000));

        const procModal = document.getElementById('payment-modal-overlay');
        if (procModal) procModal.remove();

        showPaymentModal('failed', { message: err.message || 'Error procesando el pago.' });
        NotificationManager.fetchNotifications();

        processBtn.disabled = false;
        processBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Intentar de Nuevo`;
      }
    });
  }
}

// --- Vista Detalle Pedido (Reembolso) ---
function setupOrderDetailEvents() {
  const form = document.getElementById('refund-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const orderId = document.getElementById('refund-order-id').value;
      const reason = document.getElementById('refund-reason').value;

      try {
        const res = await API.post('/refunds', { orderId, reason });
        showToast(res.message, 'success');
        // Recargar vista de detalle de pedido
        window.location.reload();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }
}

// --- Vista de Administración ---
function setupAdminEvents(tab) {
  // Sidebar Tabs Navigation
  const sidebar = document.querySelector('.admin-sidebar');
  if (sidebar) {
    sidebar.addEventListener('click', (e) => {
      const btn = e.target.closest('.admin-tab-btn');
      if (btn) {
        const t = btn.getAttribute('data-tab');
        window.location.hash = `#admin/${t}`;
      }
    });
  }

  // --- TAB: Productos (CRUD) ---
  if (tab === 'products') {
    const addBtn = document.getElementById('admin-add-prod-btn');
    const tableBody = document.querySelector('.table tbody');

    // Botón Agregar Producto (Abre Modal dinámico)
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        openProductModal();
      });
    }

    // Botones Editar/Eliminar
    if (tableBody) {
      tableBody.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.admin-edit-prod-btn');
        const deleteBtn = e.target.closest('.admin-delete-prod-btn');

        if (editBtn) {
          const id = editBtn.getAttribute('data-id');
          const product = await API.get(`/products/${id}`);
          openProductModal(product);
        }

        if (deleteBtn) {
          const id = deleteBtn.getAttribute('data-id');
          if (confirm('¿Está seguro de que desea eliminar este producto del catálogo?')) {
            try {
              const res = await API.delete(`/admin/products/${id}`);
              showToast(res.message, 'success');
              // Recargar tab
              router();
            } catch (err) {
              showToast(err.message, 'error');
            }
          }
        }
      });
    }
  }

  // --- TAB: Pedidos (Actualizar despachos) ---
  if (tab === 'orders') {
    const tableBody = document.querySelector('.table tbody');
    if (tableBody) {
      tableBody.addEventListener('change', async (e) => {
        const select = e.target.closest('.admin-change-status-select');
        if (select) {
          const id = select.getAttribute('data-id');
          const newStatus = select.value;
          try {
            const res = await API.put(`/admin/orders/${id}/status`, { status: newStatus });
            showToast(res.message, 'success');
            router();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });
    }
  }

  // --- TAB: Reembolsos (Aprobar/Rechazar) ---
  if (tab === 'refunds') {
    const tableBody = document.querySelector('.table tbody');
    if (tableBody) {
      tableBody.addEventListener('click', async (e) => {
        const approveBtn = e.target.closest('.admin-refund-approve-btn');
        const rejectBtn = e.target.closest('.admin-refund-reject-btn');

        if (approveBtn) {
          const id = approveBtn.getAttribute('data-id');
          openRefundModal(id, 'approve');
        }

        if (rejectBtn) {
          const id = rejectBtn.getAttribute('data-id');
          openRefundModal(id, 'reject');
        }
      });
    }
  }
}

// ==========================================================================
// 6. Modales Dinámicos (Creación/Edición Productos & Notas Reembolsos)
// ==========================================================================

// Modal Producto
async function openProductModal(product = null) {
  // Remover modal previo si existe
  const prevModal = document.getElementById('admin-product-modal-overlay');
  if (prevModal) prevModal.remove();

  const isEdit = !!product;
  const categories = await API.get('/categories');
  
  const categoryOptions = categories.map(cat => `
    <option value="${cat.id}" ${product && product.category_id === cat.id ? 'selected' : ''}>${cat.name}</option>
  `).join('');

  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  modalOverlay.id = 'admin-product-modal-overlay';
  
  modalOverlay.innerHTML = `
    <div class="modal-content glass">
      <div class="modal-header">
        <h3>${isEdit ? 'Editar Producto' : 'Añadir Nuevo Producto'}</h3>
        <button class="close-drawer-btn" id="btn-close-prod-modal">&times;</button>
      </div>
      <div class="modal-body">
        <form id="admin-product-form">
          <div class="form-group">
            <label for="modal-prod-name">Nombre del Producto</label>
            <input type="text" id="modal-prod-name" class="form-control" value="${isEdit ? product.name : ''}" required>
          </div>
          <div class="form-group">
            <label for="modal-prod-desc">Descripción</label>
            <textarea id="modal-prod-desc" class="form-control" rows="2">${isEdit ? product.description || '' : ''}</textarea>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div class="form-group">
              <label for="modal-prod-price">Precio ($ COP)</label>
              <input type="number" id="modal-prod-price" class="form-control" value="${isEdit ? product.price : '0'}" min="0" required>
            </div>
            <div class="form-group">
              <label for="modal-prod-stock">Inventario (Stock)</label>
              <input type="number" id="modal-prod-stock" class="form-control" value="${isEdit ? product.stock : '0'}" min="0" required>
            </div>
          </div>
          <div class="form-group">
            <label for="modal-prod-category">Categoría</label>
            <select id="modal-prod-category" class="form-control">
              ${categoryOptions}
            </select>
          </div>
          <div class="form-group">
            <label for="modal-prod-img">URL Imagen</label>
            <input type="url" id="modal-prod-img" class="form-control" value="${isEdit ? product.image_url || '' : ''}">
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary btn-sm" id="btn-cancel-prod-modal">Cancelar</button>
        <button class="btn btn-primary btn-sm" id="btn-save-prod-modal">${isEdit ? 'Guardar Cambios' : 'Crear Producto'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);
  
  // Animación abrir
  setTimeout(() => modalOverlay.classList.add('open'), 10);

  // Cerrar eventos
  const close = () => {
    modalOverlay.classList.remove('open');
    setTimeout(() => modalOverlay.remove(), 300);
  };

  document.getElementById('btn-close-prod-modal').addEventListener('click', close);
  document.getElementById('btn-cancel-prod-modal').addEventListener('click', close);

  // Guardar cambios
  document.getElementById('btn-save-prod-modal').addEventListener('click', async () => {
    const payload = {
      name: document.getElementById('modal-prod-name').value,
      description: document.getElementById('modal-prod-desc').value,
      price: parseFloat(document.getElementById('modal-prod-price').value),
      stock: parseInt(document.getElementById('modal-prod-stock').value),
      categoryId: parseInt(document.getElementById('modal-prod-category').value),
      imageUrl: document.getElementById('modal-prod-img').value
    };

    if (!payload.name || isNaN(payload.price) || isNaN(payload.stock)) {
      showToast('Por favor, complete todos los campos requeridos correctamente.', 'error');
      return;
    }

    try {
      if (isEdit) {
        const res = await API.put(`/admin/products/${product.id}`, payload);
        showToast(res.message, 'success');
      } else {
        const res = await API.post('/admin/products', payload);
        showToast(res.message, 'success');
      }
      close();
      router(); // Actualizar catálogo admin
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// Modal Reembolso
function openRefundModal(refundId, action) {
  const prevModal = document.getElementById('admin-refund-modal-overlay');
  if (prevModal) prevModal.remove();

  const isApprove = action === 'approve';

  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  modalOverlay.id = 'admin-refund-modal-overlay';
  
  modalOverlay.innerHTML = `
    <div class="modal-content glass">
      <div class="modal-header">
        <h3>${isApprove ? 'Aprobar Solicitud de Reembolso' : 'Rechazar Solicitud de Reembolso'}</h3>
        <button class="close-drawer-btn" id="btn-close-ref-modal">&times;</button>
      </div>
      <div class="modal-body">
        <p style="font-size: 0.9rem; margin-bottom: 16px;">
          ${isApprove 
            ? 'Al aprobar, se enviará una solicitud de reversa a la pasarela de pagos, los productos volverán al stock y el pedido quedará cancelado.' 
            : 'Describa el motivo del rechazo del reembolso. Este será enviado al buzón del cliente.'}
        </p>
        <div class="form-group">
          <label for="modal-refund-notes">Notas / Justificación</label>
          <textarea id="modal-refund-notes" class="form-control" rows="3" placeholder="${isApprove ? 'Notas administrativas opcionales...' : 'Indique el motivo por el cual no procede la devolución...'}" required></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary btn-sm" id="btn-cancel-ref-modal">Cancelar</button>
        <button class="btn ${isApprove ? 'btn-primary' : 'btn-danger'} btn-sm" id="btn-save-ref-modal">
          ${isApprove ? 'Confirmar Aprobación' : 'Rechazar Solicitud'}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);
  
  setTimeout(() => modalOverlay.classList.add('open'), 10);

  const close = () => {
    modalOverlay.classList.remove('open');
    setTimeout(() => modalOverlay.remove(), 300);
  };

  document.getElementById('btn-close-ref-modal').addEventListener('click', close);
  document.getElementById('btn-cancel-ref-modal').addEventListener('click', close);

  document.getElementById('btn-save-ref-modal').addEventListener('click', async () => {
    const adminNotes = document.getElementById('modal-refund-notes').value;
    
    if (!isApprove && !adminNotes) {
      showToast('Debe ingresar un motivo para rechazar la solicitud.', 'error');
      return;
    }

    try {
      const res = await API.post(`/admin/refunds/${refundId}/process`, {
        action,
        adminNotes
      });
      showToast(res.message, 'success');
      close();
      router();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ==========================================================================
// 7. Configuración de Elementos del Layout Global (Navbar & Event Listeners)
// ==========================================================================
function setupGlobalUI() {
  const cartTrigger = document.getElementById('cart-trigger');
  const cartClose = document.getElementById('cart-close-btn');
  const cartOverlay = document.getElementById('cart-drawer-overlay');
  const navLogo = document.getElementById('nav-logo');
  const linkHome = document.getElementById('link-home');
  const applyCouponBtn = document.getElementById('apply-coupon-btn');
  
  // Abrir / Cerrar Carrito Drawer
  if (cartTrigger && cartOverlay) {
    cartTrigger.addEventListener('click', () => {
      CartManager.updateUI();
      cartOverlay.classList.add('open');
    });
  }
  if (cartClose && cartOverlay) {
    cartClose.addEventListener('click', () => cartOverlay.classList.remove('open'));
  }

  // Clic en logo o link de catálogo limpia filtros
  if (navLogo) navLogo.addEventListener('click', () => { window.location.hash = '#'; });
  if (linkHome) linkHome.addEventListener('click', () => { window.location.hash = '#'; });

  // Listener para cerrar drawer al hacer clic fuera del contenido
  if (cartOverlay) {
    cartOverlay.addEventListener('click', (e) => {
      if (e.target === cartOverlay) cartOverlay.classList.remove('open');
    });
  }

  // Delegar eventos dentro del Drawer del Carrito (cantidad y eliminar)
  const cartDrawerBody = document.getElementById('cart-items-container');
  if (cartDrawerBody) {
    cartDrawerBody.addEventListener('click', (e) => {
      const btnMinus = e.target.closest('.drawer-qty-minus');
      const btnPlus = e.target.closest('.drawer-qty-plus');
      const btnRemove = e.target.closest('.drawer-item-remove');
      const backToShopBtn = e.target.closest('#cart-back-to-shop-btn');

      if (btnMinus) {
        const id = parseInt(btnMinus.getAttribute('data-id'));
        const item = AppState.cart.find(i => i.productId === id);
        if (item) CartManager.updateQuantity(id, item.quantity - 1);
      }
      if (btnPlus) {
        const id = parseInt(btnPlus.getAttribute('data-id'));
        const item = AppState.cart.find(i => i.productId === id);
        if (item) CartManager.updateQuantity(id, item.quantity + 1);
      }
      if (btnRemove) {
        const id = parseInt(btnRemove.getAttribute('data-id'));
        CartManager.removeFromCart(id);
      }
      if (backToShopBtn && cartOverlay) {
        cartOverlay.classList.remove('open');
        window.location.hash = '#';
      }
    });
  }

  // Clic en botón checkout del drawer cierra drawer
  const checkoutBtn = document.getElementById('btn-cart-checkout');
  if (checkoutBtn && cartOverlay) {
    checkoutBtn.addEventListener('click', () => {
      cartOverlay.classList.remove('open');
    });
  }

  // Clic en el centro de notificaciones dropdown
  const notifBtn = document.getElementById('notif-btn');
  const notifMenu = document.getElementById('notif-menu');
  if (notifBtn && notifMenu) {
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notifMenu.classList.toggle('open');
    });
    
    // Cerrar dropdown al hacer click fuera
    document.addEventListener('click', () => {
      notifMenu.classList.remove('open');
    });
    notifMenu.addEventListener('click', (e) => e.stopPropagation());
  }

  // Delegar clicks en items de notificación para marcar leídas
  const notifItems = document.getElementById('notif-list-items');
  if (notifItems) {
    notifItems.addEventListener('click', async (e) => {
      const item = e.target.closest('.notif-item');
      if (item && item.classList.contains('unread')) {
        const id = item.getAttribute('data-id');
        await NotificationManager.markAsRead(id);
      }
    });
  }

  // Botón aplicar cupón
  if (applyCouponBtn) {
    applyCouponBtn.addEventListener('click', async () => {
      const couponInput = document.getElementById('coupon-input');
      const couponMsg = document.getElementById('coupon-message');
      const code = couponInput ? couponInput.value.trim() : '';
      
      if (!code) {
        showToast('Ingrese un código de cupón.', 'warning');
        return;
      }

      if (!Auth.isAuthenticated()) {
        showToast('Debes iniciar sesión para aplicar cupones.', 'warning');
        return;
      }

      const totals = CartManager.calculateTotals();

      try {
        const res = await API.post('/orders/coupons/validate', { code, orderTotal: totals.subtotal });
        if (res.isValid) {
          AppState.appliedCoupon = res.coupon;
          CartManager.save();
          showToast(`Cupón "${code.toUpperCase()}" aplicado correctamente.`, 'success');
          if (couponInput) couponInput.value = '';
        }
      } catch (err) {
        showToast(err.message, 'error');
        if (couponMsg) {
          couponMsg.className = 'coupon-msg error';
          couponMsg.textContent = err.message;
        }
      }
    });
  }

  // Botón Limpiar notificaciones
  const clearNotifBtn = document.getElementById('mark-all-read-btn');
  if (clearNotifBtn) {
    clearNotifBtn.addEventListener('click', async () => {
      const unreadItems = document.querySelectorAll('.notif-item.unread');
      for (const item of unreadItems) {
        const id = item.getAttribute('data-id');
        await API.put(`/notifications/${id}/read`);
      }
      NotificationManager.fetchNotifications();
    });
  }
}

// Actualizar barra de navegación basado en la sesión
function updateNavbarAuthUI() {
  const authContainer = document.getElementById('auth-actions-container');
  const privateLinks = document.querySelectorAll('.private-link');
  const clientOnlyLinks = document.querySelectorAll('.client-only');
  const adminOnlyLinks = document.querySelectorAll('.admin-only');
  const notifContainer = document.getElementById('notif-container');

  if (!authContainer) return;

  if (Auth.isAuthenticated()) {
    const user = Auth.getUser();
    
    // Renderizar avatar/nombre de usuario y botón de salir
    authContainer.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span class="user-greeting" style="font-size: 0.85rem; font-weight: 500; font-family: var(--font-family-title);">
          <i class="fa-solid fa-user"></i> ${user.full_name}
        </span>
        <button class="btn btn-secondary btn-sm" id="btn-nav-logout" title="Cerrar Sesión">
          <i class="fa-solid fa-right-from-bracket"></i>
        </button>
      </div>
    `;

    // Configurar evento de cierre de sesión
    document.getElementById('btn-nav-logout').addEventListener('click', () => {
      Auth.logout();
      showToast('Sesión cerrada correctamente', 'info');
      window.location.hash = '#';
    });

    // Mostrar links privados
    privateLinks.forEach(link => link.style.display = 'none');
    if (Auth.isAdmin()) {
      adminOnlyLinks.forEach(link => link.style.display = 'flex');
    } else {
      clientOnlyLinks.forEach(link => link.style.display = 'flex');
    }

    // Mostrar notificaciones
    if (notifContainer) notifContainer.style.display = 'block';
    
    // Iniciar polling de notificaciones
    NotificationManager.startPolling();

  } else {
    // No autenticado
    authContainer.innerHTML = `
      <a href="#login" class="btn btn-primary btn-sm" id="btn-nav-login">Iniciar Sesión</a>
    `;

    // Ocultar links privados e in-app notificaciones
    privateLinks.forEach(link => link.style.display = 'none');
    if (notifContainer) notifContainer.style.display = 'none';

    // Detener polling de notificaciones
    NotificationManager.stopPolling();
  }
}

// Highlight menú activo en la barra superior
function highlightActiveNav() {
  const hash = window.location.hash || '#';
  const links = document.querySelectorAll('.nav-link');
  
  links.forEach(link => {
    link.classList.remove('active');
    const href = link.getAttribute('href');
    
    if (hash === href || (hash.startsWith(href) && href !== '#')) {
      link.classList.add('active');
    }
  });
}

// Inicialización de la Aplicación al arrancar
window.addEventListener('DOMContentLoaded', () => {
  Auth.checkSessionOnLoad();
  CartManager.init();
  setupGlobalUI();
  updateNavbarAuthUI();
  
  // Escuchar cambios de sesión globales
  window.addEventListener('authChange', () => {
    updateNavbarAuthUI();
    router();
  });

  // Escuchar cambios de hash de URL (Routing)
  window.addEventListener('hashchange', () => {
    router();
    highlightActiveNav();
  });

  // Re-montar Stripe Elements si cambia el tema en checkout
  window.addEventListener('themeChange', () => {
    if (window.location.hash === '#checkout' && AppState.stripeCardElement) {
      mountStripeCardElement();
    }
  });

  // Arrancar primer renderizado
  router();
  highlightActiveNav();
});
