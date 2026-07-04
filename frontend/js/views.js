/**
 * Plantillas HTML de AeroShop (SPA Views Engine)
 */
const Views = {
  /**
   * Escapa texto para prevenir XSS al usar innerHTML.
   */
  escape(value) {
    return escapeHtml(value);
  },

  safeUrl(url) {
    return sanitizeUrl(url);
  },

  /**
   * Formatea un número como pesos colombianos (COP).
   */
  formatCurrency(value) {
    return value.toLocaleString('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  },

  /**
   * 1. Vista de Catálogo (Home)
   */
  Home(products, categories, selectedCategory = '', searchQuery = '') {
    // Generar opciones de categoría para el selector
    let categoryOptions = `<option value="">Todas las Categorías</option>`;
    categories.forEach(cat => {
      const selected = (selectedCategory === cat.slug || selectedCategory == cat.id) ? 'selected' : '';
      categoryOptions += `<option value="${this.escape(cat.slug)}" ${selected}>${this.escape(cat.name)}</option>`;
    });

    // Generar cuadrícula de productos
    let productsHtml = '';
    if (products.length === 0) {
      productsHtml = `
        <div class="catalog-empty card glass">
          <i class="fa-solid fa-face-frown"></i>
          <h2>No se encontraron productos</h2>
          <p>Prueba buscando con otros términos o seleccionando otra categoría.</p>
        </div>
      `;
    } else {
      productsHtml = products.map(prod => {
        const isOutOfStock = prod.stock <= 0;
        return `
          <div class="card product-card ${isOutOfStock ? 'out-of-stock' : ''}" data-id="${prod.id}">
            <div class="product-img-container">
              <img src="${this.safeUrl(prod.image_url)}" alt="${this.escape(prod.name)}" class="product-img">
              <span class="category-badge">${this.escape(prod.category_name)}</span>
              ${isOutOfStock ? `<div class="stock-out-badge">Agotado</div>` : ''}
            </div>
            <div class="product-info">
              <h3 class="product-title">${this.escape(prod.name)}</h3>
              <p class="product-desc">${this.escape(prod.description || 'Sin descripción disponible.')}</p>
              <div class="product-price-action">
                <span class="product-price">${this.formatCurrency(prod.price)}</span>
                <button class="btn btn-primary btn-sm btn-add-to-cart-quick" data-id="${prod.id}" ${isOutOfStock ? 'disabled' : ''}>
                  <i class="fa-solid fa-cart-plus"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    return `
      <div class="catalog-header">
        <div class="catalog-title-wrapper">
          <h1>Explora AeroShop</h1>
          <p class="text-muted">Innovación, velocidad y estilo en un solo lugar.</p>
        </div>
        
        <div class="search-filter-bar card glass">
          <div class="search-wrapper">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" id="search-input" class="form-control" placeholder="Buscar productos..." value="${this.escape(searchQuery)}">
          </div>
          <div class="filter-wrapper">
            <select id="category-filter" class="form-control">
              ${categoryOptions}
            </select>
          </div>
        </div>
      </div>
      
      <div class="products-grid">
        ${productsHtml}
      </div>
    `;
  },

  /**
   * 2. Vista de Ficha de Producto (Detail)
   */
  ProductDetail(product) {
    const isOutOfStock = product.stock <= 0;
    return `
      <div style="margin-bottom: 24px;">
        <a href="#" class="btn btn-secondary btn-sm"><i class="fa-solid fa-arrow-left"></i> Volver al Catálogo</a>
      </div>
      
      <div class="product-detail-container card glass">
        <div class="detail-img-container">
          <img src="${this.safeUrl(product.image_url)}" alt="${this.escape(product.name)}">
        </div>
        
        <div class="detail-info">
          <span class="detail-category">${this.escape(product.category_name)}</span>
          <h1 class="detail-title">${this.escape(product.name)}</h1>
          <div class="detail-price">${this.formatCurrency(product.price)}</div>
          <p class="detail-description">${this.escape(product.description || 'Este producto no cuenta con descripción detallada.')}</p>
          
          <div class="detail-meta">
            <span class="meta-item">Disponibilidad: <strong style="color: ${isOutOfStock ? 'var(--danger)' : 'var(--success)'};">${isOutOfStock ? 'Agotado' : `${product.stock} unidades`}</strong></span>
            <span class="meta-item">Garantía: <strong>1 Año Oficial</strong></span>
          </div>
          
          <div class="detail-actions">
            ${!isOutOfStock ? `
              <div class="qty-selector">
                <button class="qty-btn" id="qty-minus"><i class="fa-solid fa-minus"></i></button>
                <input type="number" id="detail-qty" class="qty-input" value="1" min="1" max="${product.stock}">
                <button class="qty-btn" id="qty-plus"><i class="fa-solid fa-plus"></i></button>
              </div>
              <button class="btn btn-primary" id="btn-add-to-cart-detail" data-id="${product.id}">
                <i class="fa-solid fa-shopping-cart"></i> Añadir al Carrito
              </button>
            ` : `
              <button class="btn btn-secondary" disabled>Producto Agotado</button>
            `}
          </div>
        </div>
      </div>
    `;
  },

  /**
   * 3. Vista de Iniciar Sesión (Login)
   */
  Login() {
    return `
      <div class="auth-container card glass">
        <div class="auth-header">
          <h1>Iniciar Sesión</h1>
          <p>Bienvenido de vuelta a AeroShop</p>
        </div>

        <div id="login-error" class="auth-error" role="alert" hidden></div>
        
        <div class="oauth-buttons">
          <button type="button" class="btn-oauth btn-oauth--google" id="btn-google-login" aria-label="Continuar con Google">
            <span class="btn-oauth__icon">${OAuthIcons.google}</span>
            <span class="btn-oauth__text">Continuar con Google</span>
          </button>
          <button type="button" class="btn-oauth btn-oauth--apple" id="btn-apple-login" aria-label="Continuar con Apple">
            <span class="btn-oauth__icon">${OAuthIcons.apple}</span>
            <span class="btn-oauth__text">Continuar con Apple</span>
          </button>
        </div>
        
        <div class="auth-divider">o ingresa con tu correo</div>
        
        <form id="login-form" novalidate>
          <div class="form-group">
            <label for="login-email">Correo Electrónico</label>
            <input type="email" id="login-email" class="form-control" placeholder="ejemplo@correo.com" autocomplete="email" required>
          </div>
          
          <div class="form-group">
            <label for="login-password">Contraseña</label>
            <input type="password" id="login-password" class="form-control" placeholder="••••••••" autocomplete="current-password" required>
          </div>
          
          <button type="submit" class="btn btn-primary btn-block">Ingresar de Forma Segura</button>
        </form>
        
        <div class="auth-footer">
          ¿No tienes una cuenta? <a href="#register" class="auth-link">Regístrate gratis</a>
        </div>
      </div>
    `;
  },

  /**
   * 4. Vista de Registro (Register)
   */
  Register() {
    return `
      <div class="auth-container card glass">
        <div class="auth-header">
          <h1>Crear Cuenta</h1>
          <p>Regístrate para comenzar a comprar</p>
        </div>

        <div id="register-error" class="auth-error" role="alert" hidden></div>

        <div class="oauth-buttons">
          <button type="button" class="btn-oauth btn-oauth--google" id="btn-google-login" aria-label="Registrarse con Google">
            <span class="btn-oauth__icon">${OAuthIcons.google}</span>
            <span class="btn-oauth__text">Registrarse con Google</span>
          </button>
          <button type="button" class="btn-oauth btn-oauth--apple" id="btn-apple-login" aria-label="Registrarse con Apple">
            <span class="btn-oauth__icon">${OAuthIcons.apple}</span>
            <span class="btn-oauth__text">Registrarse con Apple</span>
          </button>
        </div>

        <div class="auth-divider">o regístrate con tu correo</div>
        
        <form id="register-form" novalidate>
          <div class="form-group">
            <label for="register-name">Nombre Completo</label>
            <input type="text" id="register-name" class="form-control" placeholder="Elian Perez" required>
          </div>
          
          <div class="form-group">
            <label for="register-email">Correo Electrónico</label>
            <input type="email" id="register-email" class="form-control" placeholder="ejemplo@correo.com" required>
          </div>
          
          <div class="form-group">
            <label for="register-password">Contraseña (Mínimo 8 caracteres, letra y número)</label>
            <input type="password" id="register-password" class="form-control" placeholder="******" minlength="8" required>
          </div>
          
          <button type="submit" class="btn btn-primary btn-block" style="margin-top: 10px;">Crear Cuenta Nueva</button>
        </form>
        
        <div class="auth-footer">
          ¿Ya tienes una cuenta? <a href="#login" class="auth-link">Inicia sesión</a>
        </div>
      </div>
    `;
  },

  /**
   * 5. Vista de Checkout (Pasos Acordeón)
   */
  Checkout(cartItems, subtotal, discount, total, activeStep = 1, user = null) {
    if (cartItems.length === 0) {
      return `
        <div class="catalog-empty card glass">
          <i class="fa-solid fa-cart-arrow-down"></i>
          <h2>Tu carrito está vacío</h2>
          <p>Para proceder al pago, debes añadir al menos un producto al carrito.</p>
          <a href="#" class="btn btn-primary" style="margin-top: 20px;">Volver al Catálogo</a>
        </div>
      `;
    }

    return `
      <h1 class="orders-view-title">Proceso de Pago</h1>
      
      <div class="checkout-grid">
        <div class="checkout-steps">
          <!-- Paso 1: Datos de Envío -->
          <div class="checkout-step card glass ${activeStep === 1 ? 'active' : ''}" id="step-1-card">
            <div class="checkout-step-header" data-step="1">
              <span class="step-number">1</span>
              <h2>Información de Envío</h2>
              <i class="fa-solid fa-chevron-down"></i>
            </div>
            <div class="checkout-step-body">
              <div class="form-group">
                <label for="shipping-name">Nombre Destinatario</label>
                <input type="text" id="shipping-name" class="form-control" value="${user ? this.escape(user.full_name) : ''}" required>
              </div>
              <div class="form-group">
                <label for="shipping-address">Dirección de Entrega</label>
                <input type="text" id="shipping-address" class="form-control" placeholder="Calle 45 # 12 - 34, Apto 402" required>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                <div class="form-group">
                  <label for="shipping-department">Departamento</label>
                  <select id="shipping-department" class="form-control" required>
                    <option value="">Seleccione Departamento...</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="shipping-city">Ciudad / Municipio</label>
                  <select id="shipping-city" class="form-control" disabled required>
                    <option value="">Seleccione un departamento primero</option>
                  </select>
                </div>
              </div>
              <button class="btn btn-primary btn-block" id="btn-next-step-1" style="margin-top: 10px;">Siguiente Paso</button>
            </div>
          </div>

          <!-- Paso 2: Método de Pago -->
          <div class="checkout-step card glass ${activeStep === 2 ? 'active' : ''}" id="step-2-card">
            <div class="checkout-step-header" data-step="2">
              <span class="step-number">2</span>
              <h2>Método de Pago</h2>
              <i class="fa-solid fa-chevron-down"></i>
            </div>
            <div class="checkout-step-body">

              <!-- Selector de Método -->
              <div class="payment-methods-selector">
                <div class="payment-method-card selected" data-method="card" id="pm-card">
                  <i class="fa-solid fa-credit-card"></i>
                  <span>Tarjeta</span>
                </div>
                <div class="payment-method-card" data-method="pse" id="pm-pse">
                  <i class="fa-solid fa-building-columns"></i>
                  <span>PSE / Banco</span>
                </div>
                <div class="payment-method-card" data-method="wallet" id="pm-wallet">
                  <i class="fa-solid fa-wallet"></i>
                  <span>Wallet</span>
                </div>
              </div>

              <!-- ══════════════════════════════════════ -->
              <!-- FORMULARIO: TARJETA DE CRÉDITO         -->
              <!-- ══════════════════════════════════════ -->
              <div id="payment-form-card" class="payment-form-details">

                <!-- Tarjeta 3D Interactiva -->
                <div class="card-3d-scene">
                  <div class="card-3d" id="card-3d-widget">
                    <!-- Cara Frontal -->
                    <div class="card-face card-front">
                      <div class="card-top-row">
                        <div class="card-chip"></div>
                        <div class="card-network">
                          <div class="circle circle-1"></div>
                          <div class="circle circle-2"></div>
                        </div>
                      </div>
                      <div class="card-number-display" id="card-num-display">•••• •••• •••• ••••</div>
                      <div class="card-bottom-row">
                        <div>
                          <div class="card-label">Titular</div>
                          <div class="card-value" id="card-holder-display">NOMBRE APELLIDO</div>
                        </div>
                        <div>
                          <div class="card-label">Vence</div>
                          <div class="card-value" id="card-expiry-display">MM/AA</div>
                        </div>
                        <div class="card-logo">AERO</div>
                      </div>
                    </div>
                    <!-- Cara Trasera -->
                    <div class="card-face card-back">
                      <div class="card-magnetic-strip"></div>
                      <div class="card-signature-strip">
                        <div class="card-cvv-display" id="card-cvv-display">•••</div>
                      </div>
                      <div class="card-back-brand">AeroShop Secure · CVV</div>
                    </div>
                  </div>
                </div>

                <!-- Campos del formulario -->
                <div class="form-group">
                  <label for="card-holder">Nombre en la Tarjeta</label>
                  <div class="card-input-group">
                    <input type="text" id="card-holder" class="form-control" placeholder="JUAN PÉREZ" autocomplete="cc-name">
                    <i class="card-input-icon fa-solid fa-user"></i>
                  </div>
                </div>
                <div id="stripe-card-fields" class="form-group" style="display: none;">
                  <label>Datos de la Tarjeta</label>
                  <div id="stripe-card-element" class="stripe-card-element"></div>
                  <div id="stripe-card-errors" class="stripe-card-errors" role="alert"></div>
                </div>
                <div id="legacy-card-fields">
                  <div class="form-group">
                    <label for="card-number">Número de Tarjeta</label>
                    <div class="card-input-group">
                      <input type="text" id="card-number" class="form-control" placeholder="4111 2222 3333 4444" maxlength="19" autocomplete="cc-number" inputmode="numeric">
                      <i class="card-input-icon fa-solid fa-credit-card"></i>
                    </div>
                  </div>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                      <label for="card-expiry">Fecha Expiración</label>
                      <div class="card-input-group">
                        <input type="text" id="card-expiry" class="form-control" placeholder="MM/AA" maxlength="5" autocomplete="cc-exp">
                        <i class="card-input-icon fa-solid fa-calendar"></i>
                      </div>
                    </div>
                    <div class="form-group">
                      <label for="card-cvv">Código CVV</label>
                      <div class="card-input-group">
                        <input type="password" id="card-cvv" class="form-control" placeholder="•••" maxlength="4" autocomplete="cc-csc">
                        <i class="card-input-icon fa-solid fa-lock"></i>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="security-badge">
                  <i class="fa-solid fa-shield-halved"></i>
                  <span>Transacción cifrada con SSL 256-bit. Tus datos nunca son almacenados.</span>
                </div>
              </div>

              <!-- ══════════════════════════════════════ -->
              <!-- FORMULARIO: PSE / TRANSFERENCIA BANCO  -->
              <!-- ══════════════════════════════════════ -->
              <div id="payment-form-pse" class="payment-form-details" style="display: none;">
                <div style="text-align:center; padding: 16px 0 24px; font-family: var(--font-mono); font-size: 0.8rem; color: var(--white-dim); border-bottom: var(--border-dim); margin-bottom: 20px;">
                  <i class="fa-solid fa-building-columns" style="font-size: 2.5rem; color: var(--cyan); display: block; margin-bottom: 12px;"></i>
                  Serás redirigido a la plataforma segura de tu banco para autorizar el débito.
                </div>
                <div class="form-group">
                  <label for="pse-bank">Entidad Bancaria</label>
                  <select id="pse-bank" class="form-control">
                    <option value="">-- Elige tu banco --</option>
                    <option value="Bancolombia">Bancolombia</option>
                    <option value="Banco de Bogotá">Banco de Bogotá</option>
                    <option value="Davivienda">Davivienda</option>
                    <option value="BBVA">BBVA Colombia</option>
                    <option value="Nequi">Nequi (PSE)</option>
                    <option value="Daviplata">Daviplata (PSE)</option>
                    <option value="Banco Agrario">Banco Agrario</option>
                    <option value="Scotiabank Colpatria">Scotiabank Colpatria</option>
                    <option value="AV Villas">AV Villas</option>
                    <option value="Banco de Rechazo">⚠️ Banco de Prueba (Genera Fallo)</option>
                  </select>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                  <div class="form-group">
                    <label for="pse-doc-type">Tipo de Documento</label>
                    <select id="pse-doc-type" class="form-control">
                      <option value="CC">Cédula (C.C.)</option>
                      <option value="CE">Cédula Extranjería</option>
                      <option value="NIT">NIT Empresa</option>
                      <option value="PP">Pasaporte</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label for="pse-doc-number">Número de Documento</label>
                    <input type="text" id="pse-doc-number" class="form-control" placeholder="10203040" inputmode="numeric">
                  </div>
                </div>
                <div class="security-badge">
                  <i class="fa-solid fa-shield-halved"></i>
                  <span>Procesado por ACH Colombia. Transacción segura certificada.</span>
                </div>
              </div>

              <!-- ══════════════════════════════════════ -->
              <!-- FORMULARIO: BILLETERA DIGITAL           -->
              <!-- ══════════════════════════════════════ -->
              <div id="payment-form-wallet" class="payment-form-details" style="display: none;">
                <div style="text-align:center; padding: 16px 0 24px; font-family: var(--font-mono); font-size: 0.8rem; color: var(--white-dim); border-bottom: var(--border-dim); margin-bottom: 20px;">
                  <i class="fa-solid fa-mobile-screen-button" style="font-size: 2.5rem; color: var(--cyan); display: block; margin-bottom: 12px;"></i>
                  Ingresa tu celular registrado en la billetera y el código OTP que recibirás por SMS.
                </div>
                <div class="form-group">
                  <label for="wallet-phone">Celular Vinculado a la Wallet</label>
                  <div class="card-input-group">
                    <input type="text" id="wallet-phone" class="form-control" placeholder="310 123 4567" maxlength="10" inputmode="numeric">
                    <i class="card-input-icon fa-solid fa-mobile-alt"></i>
                  </div>
                </div>
                <div class="form-group">
                  <label for="wallet-otp">Código OTP (enviado por SMS)</label>
                  <div class="card-input-group">
                    <input type="text" id="wallet-otp" class="form-control" placeholder="1234" maxlength="4" value="1234" inputmode="numeric">
                    <i class="card-input-icon fa-solid fa-key"></i>
                  </div>
                  <span class="text-muted" style="font-size: 0.72rem; font-family: var(--font-mono); display: block; margin-top: 6px; color: rgba(255,255,255,0.3);">Para probar un fallo, ingresa '0000' como OTP.</span>
                </div>
                <div class="security-badge">
                  <i class="fa-solid fa-shield-halved"></i>
                  <span>Verificación en dos pasos. Código de un solo uso.</span>
                </div>
              </div>

              <button class="btn btn-primary btn-block" id="btn-process-checkout" style="margin-top: 24px; padding: 16px; font-size: 1rem;">
                <i class="fa-solid fa-lock"></i> Pagar de Forma Segura (${this.formatCurrency(total)})
              </button>
            </div>
          </div>
        </div>

        <!-- Columna Resumen del Pedido -->
        <div class="checkout-summary-card card glass">
          <h2 class="checkout-summary-title">Resumen del Pedido</h2>
          
          <div class="checkout-summary-items">
            ${cartItems.map(item => `
              <div class="summary-item">
                <span class="summary-item-name">${this.escape(item.name)} x${item.quantity}</span>
                <span class="summary-item-price">${this.formatCurrency(item.price * item.quantity)}</span>
              </div>
            `).join('')}
          </div>
          
          <div class="cart-totals">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>${this.formatCurrency(subtotal)}</span>
            </div>
            ${discount > 0 ? `
              <div class="total-row discount-row">
                <span>Descuento:</span>
                <span>-${this.formatCurrency(discount)}</span>
              </div>
            ` : ''}
            <div class="total-row grand-total">
              <span>Total a Pagar:</span>
              <span>${this.formatCurrency(total)}</span>
            </div>
          </div>

          <!-- Métodos de pago aceptados -->
          <div style="margin-top: 20px; padding-top: 16px; border-top: var(--border-dim);">
            <div style="font-family: var(--font-mono); font-size: 0.65rem; color: var(--white-dim); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px;">Métodos Aceptados</div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <span style="background: var(--surface-2); border: var(--border-dim); padding: 4px 10px; font-size: 0.7rem; font-family: var(--font-mono); color: var(--white-dim);">VISA</span>
              <span style="background: var(--surface-2); border: var(--border-dim); padding: 4px 10px; font-size: 0.7rem; font-family: var(--font-mono); color: var(--white-dim);">MC</span>
              <span style="background: var(--surface-2); border: var(--border-dim); padding: 4px 10px; font-size: 0.7rem; font-family: var(--font-mono); color: var(--white-dim);">AMEX</span>
              <span style="background: var(--surface-2); border: var(--border-dim); padding: 4px 10px; font-size: 0.7rem; font-family: var(--font-mono); color: var(--white-dim);">PSE</span>
              <span style="background: var(--surface-2); border: var(--border-dim); padding: 4px 10px; font-size: 0.7rem; font-family: var(--font-mono); color: var(--white-dim);">WALLET</span>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * 5.1 Pantalla de Compra Exitosa
   */
  CheckoutSuccess(orderId, trackingNumber, finalAmount) {
    return `
      <div class="checkout-success-view card glass">
        <div class="success-icon">
          <i class="fa-solid fa-check"></i>
        </div>
        <h1 class="success-title">¡Compra Exitosa!</h1>
        <p class="success-desc">Tu pago por valor de <strong>${this.formatCurrency(finalAmount)}</strong> ha sido procesado de forma segura y tu pedido ha sido registrado.</p>
        
        <div class="tracking-card">
          <span>Código de Seguimiento</span>
          <div class="tracking-code" id="success-tracking-code">${this.escape(trackingNumber)}</div>
        </div>
        
        <div style="display: flex; gap: 12px; justify-content: center;">
          <a href="#orders" class="btn btn-primary">Ver mis Pedidos</a>
          <a href="#" class="btn btn-secondary">Seguir Comprando</a>
        </div>
      </div>
    `;
  },

  /**
   * 6. Vista de Historial de Pedidos
   */
  Orders(orders) {
    if (orders.length === 0) {
      return `
        <h1 class="orders-view-title">Mis Pedidos</h1>
        <div class="catalog-empty card glass">
          <i class="fa-solid fa-box-open"></i>
          <h2>Aún no has realizado compras</h2>
          <p>Visita nuestro catálogo y elige los productos que más te gusten.</p>
          <a href="#" class="btn btn-primary" style="margin-top: 20px;">Ir de Compras</a>
        </div>
      `;
    }

    const rows = orders.map(order => {
      const date = new Date(order.created_at).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      return `
        <tr>
          <td>#${order.id}</td>
          <td>${date}</td>
          <td>${this.escape(order.tracking_number)}</td>
          <td>${this.formatCurrency(order.final_amount)}</td>
          <td><span class="status-badge status-${order.status}">${order.status.replace('_', ' ')}</span></td>
          <td>
            <a href="#orders/${order.id}" class="btn btn-secondary btn-sm"><i class="fa-solid fa-eye"></i> Detalles</a>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <h1 class="orders-view-title">Historial de Pedidos</h1>
      
      <div class="card glass" style="padding: 12px;">
        <div class="orders-table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>N° Pedido</th>
                <th>Fecha</th>
                <th>Seguimiento</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  /**
   * 7. Vista de Detalle de Pedido (Tracking & Reembolso)
   */
  OrderDetail(order) {
    const date = new Date(order.created_at).toLocaleDateString('es-CO', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // Construir la línea de tiempo de seguimiento
    const statuses = ['pending', 'paid', 'shipped', 'delivered'];
    const currentStatusIdx = statuses.indexOf(order.status);
    
    let timelineHtml = '';
    
    // Si el pedido no está cancelado o devuelto, mostramos timeline normal
    if (order.status !== 'cancelled' && order.status !== 'refunded' && order.status !== 'refund_requested') {
      const stepLabels = ['Pedido Creado', 'Pago Confirmado', 'Enviado', 'Entregado'];
      const stepIcons = ['fa-file-invoice', 'fa-credit-card', 'fa-truck', 'fa-box-open'];
      
      timelineHtml = `
        <div class="order-tracking-timeline">
          ${statuses.map((s, idx) => {
            let cls = '';
            if (idx < currentStatusIdx) cls = 'completed';
            else if (idx === currentStatusIdx) cls = 'active';
            
            return `
              <div class="timeline-step ${cls}">
                <div class="timeline-dot">
                  <i class="fa-solid ${stepIcons[idx]}"></i>
                </div>
                <div class="timeline-label">${stepLabels[idx]}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else {
      // Estado especial (Cancelado o Reembolsado)
      let statusColor = 'var(--text-muted)';
      let statusIcon = 'fa-ban';
      let statusText = 'Pedido Cancelado';

      if (order.status === 'refund_requested') {
        statusColor = 'var(--accent)';
        statusIcon = 'fa-clock-rotate-left';
        statusText = 'Reembolso en Revisión';
      } else if (order.status === 'refunded') {
        statusColor = 'var(--text-muted)';
        statusIcon = 'fa-rotate-left';
        statusText = 'Pedido Reembolsado';
      }

      timelineHtml = `
        <div class="card glass" style="margin: 20px 0; border-color: ${statusColor}; text-align: center; padding: 24px;">
          <i class="fa-solid ${statusIcon}" style="font-size: 2.5rem; color: ${statusColor}; margin-bottom: 12px;"></i>
          <h3 style="color: ${statusColor}; font-family: var(--font-family-title); font-size: 1.3rem;">${statusText}</h3>
          <p class="text-muted" style="margin-top: 6px;">Este pedido tiene el estado transaccional de: ${order.status.toUpperCase()}</p>
        </div>
      `;
    }

    // Seccion de solicitud de Reembolso
    let refundSectionHtml = '';
    
    if (order.refund) {
      // Si ya solicitó reembolso, mostrar estado de este
      let statusCls = `status-${order.refund.status}`;
      refundSectionHtml = `
        <div class="card glass" style="margin-top: 30px; border-left: 4px solid var(--primary);">
          <h3 style="font-family: var(--font-family-title); margin-bottom: 12px;"><i class="fa-solid fa-clock-rotate-left"></i> Estado de tu Reembolso</h3>
          <p style="font-size: 0.9rem; margin-bottom: 8px;"><strong>Motivo:</strong> ${this.escape(order.refund.reason)}</p>
          <p style="font-size: 0.9rem; margin-bottom: 8px;"><strong>Estado:</strong> <span class="status-badge ${statusCls}">${order.refund.status}</span></p>
          ${order.refund.admin_notes ? `<p style="font-size: 0.9rem; margin-top: 8px; padding: 8px; background: rgba(255,255,255,0.02); border-radius: 4px;"><strong>Comentarios del Administrador:</strong> ${this.escape(order.refund.admin_notes)}</p>` : ''}
        </div>
      `;
    } else if (order.status === 'paid' || order.status === 'delivered') {
      // Permitir solicitar reembolso si está en estado elegible
      refundSectionHtml = `
        <div class="card glass" style="margin-top: 30px;" id="refund-request-card">
          <h3 style="font-family: var(--font-family-title); margin-bottom: 12px;"><i class="fa-solid fa-rotate-left"></i> Solicitar Reembolso</h3>
          <p class="text-muted" style="font-size: 0.85rem; margin-bottom: 16px;">
            Si tienes algún inconveniente con tu compra, puedes solicitar la devolución de tu dinero. El administrador revisará tu caso y se procesará el dinero a tu método de pago.
          </p>
          <form id="refund-form">
            <input type="hidden" id="refund-order-id" value="${order.id}">
            <div class="form-group">
              <label for="refund-reason">Motivo del Reembolso</label>
              <textarea id="refund-reason" class="form-control" rows="3" placeholder="Describe brevemente por qué deseas el reembolso de tu pedido..." required></textarea>
            </div>
            <button type="submit" class="btn btn-danger btn-sm"><i class="fa-solid fa-paper-plane"></i> Enviar Solicitud de Reembolso</button>
          </form>
        </div>
      `;
    }

    return `
      <div style="margin-bottom: 24px;">
        <a href="#orders" class="btn btn-secondary btn-sm"><i class="fa-solid fa-arrow-left"></i> Volver a mis Pedidos</a>
      </div>

      <div class="checkout-grid">
        <div>
          <div class="card glass">
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 16px; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
              <div>
                <h1 style="font-family: var(--font-family-title); font-size: 1.6rem; font-weight: 800;">Pedido #${order.id}</h1>
                <span class="text-muted" style="font-size: 0.85rem;">Realizado el ${date}</span>
              </div>
              <div>
                <span class="status-badge status-${order.status}">${order.status.replace('_', ' ')}</span>
              </div>
            </div>

            <!-- Timeline -->
            ${timelineHtml}

            <!-- Productos -->
            <div style="margin-top: 30px;">
              <h3 style="font-family: var(--font-family-title); margin-bottom: 16px;">Productos Comprados</h3>
              <div style="display: flex; flex-direction: column; gap: 14px;">
                ${order.items.map(item => `
                  <div style="display: flex; gap: 16px; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
                    <img src="${this.safeUrl(item.image_url)}" alt="${this.escape(item.product_name)}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-color);">
                    <div style="flex-grow: 1;">
                      <h4 style="font-family: var(--font-family-title); font-size: 0.95rem;">${this.escape(item.product_name)}</h4>
                      <span class="text-muted" style="font-size: 0.85rem;">${this.formatCurrency(item.unit_price)} x ${item.quantity}</span>
                    </div>
                    <span style="font-weight: 700; font-size: 0.95rem;">${this.formatCurrency(item.total_price)}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Refund Section -->
          ${refundSectionHtml}
        </div>

        <!-- Columna Resumen Pago -->
        <div class="card glass">
          <h3 style="font-family: var(--font-family-title); margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">Detalles de la Transacción</h3>
          
          <div class="cart-totals" style="gap: 12px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
              <span class="text-muted">Método de Pago:</span>
              <span style="font-weight: 600; text-transform: uppercase;">${order.payment_method === 'card' ? 'Tarjeta' : order.payment_method}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
              <span class="text-muted">Estado de Pago:</span>
              <span style="font-weight: 600; text-transform: uppercase; color: ${order.payment_status === 'completed' ? 'var(--success)' : 'inherit'};">${order.payment_status}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
              <span class="text-muted">Código Seguimiento:</span>
              <span style="font-family: var(--font-family-title); font-weight: 700; color: var(--primary);">${this.escape(order.tracking_number)}</span>
            </div>
            
            <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 12px 0;">

            <div class="total-row">
              <span>Subtotal:</span>
              <span>${this.formatCurrency(order.total_amount)}</span>
            </div>
            ${order.discount_amount > 0 ? `
              <div class="total-row discount-row">
                <span>Descuento:</span>
                <span>-${this.formatCurrency(order.discount_amount)}</span>
              </div>
            ` : ''}
            <div class="total-row grand-total">
              <span>Total Pagado:</span>
              <span>${this.formatCurrency(order.final_amount)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * 8. Vista del Panel Administrativo (Monolítico de Tablas)
   */
  Admin(activeTab = 'products', data = []) {
    const tabs = [
      { id: 'products', label: 'Catálogo de Productos', icon: 'fa-box' },
      { id: 'orders', label: 'Pedidos Realizados', icon: 'fa-file-invoice' },
      { id: 'refunds', label: 'Solicitudes Reembolso', icon: 'fa-rotate-left' },
      { id: 'users', label: 'Usuarios y Cuentas', icon: 'fa-users' }
    ];

    const tabButtons = tabs.map(tab => `
      <button class="admin-tab-btn ${activeTab === tab.id ? 'active' : ''}" data-tab="${tab.id}">
        <i class="fa-solid ${tab.icon}"></i> ${tab.label}
      </button>
    `).join('');

    let tabContentHtml = '';

    switch (activeTab) {
      case 'products':
        tabContentHtml = this._renderAdminProducts(data);
        break;
      case 'orders':
        tabContentHtml = this._renderAdminOrders(data);
        break;
      case 'refunds':
        tabContentHtml = this._renderAdminRefunds(data);
        break;
      case 'users':
        tabContentHtml = this._renderAdminUsers(data);
        break;
    }

    return `
      <h1 class="orders-view-title"><i class="fa-solid fa-gears"></i> Panel Administrativo</h1>
      
      <div class="admin-grid">
        <div class="admin-sidebar card glass">
          ${tabButtons}
        </div>
        
        <div class="admin-tab-content" id="admin-tab-viewport">
          ${tabContentHtml}
        </div>
      </div>
    `;
  },

  /**
   * TAB ADMIN: Productos
   */
  _renderAdminProducts(products) {
    const productRows = products.map(prod => `
      <tr>
        <td>#${prod.id}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <img src="${this.safeUrl(prod.image_url)}" style="width: 34px; height: 34px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-color);">
            <span style="font-weight: 600;">${this.escape(prod.name)}</span>
          </div>
        </td>
        <td>${this.escape(prod.category_name)}</td>
        <td>${this.formatCurrency(prod.price)}</td>
        <td style="color: ${prod.stock <= 3 ? 'var(--danger)' : 'inherit'}; font-weight: ${prod.stock <= 3 ? '700' : 'normal'};">
          ${prod.stock} uds
        </td>
        <td>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary btn-sm admin-edit-prod-btn" data-id="${prod.id}"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-danger btn-sm admin-delete-prod-btn" data-id="${prod.id}"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join('');

    return `
      <div class="tab-header">
        <h2>Inventario de Productos</h2>
        <button class="btn btn-primary btn-sm" id="admin-add-prod-btn"><i class="fa-solid fa-plus"></i> Añadir Producto</button>
      </div>
      
      <div class="card glass" style="padding: 12px;">
        <div class="orders-table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${productRows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  /**
   * TAB ADMIN: Pedidos
   */
  _renderAdminOrders(orders) {
    const statusOptions = ['pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refund_requested', 'refunded'];
    
    const orderRows = orders.map(order => {
      const date = new Date(order.created_at).toLocaleDateString('es-CO', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      // Crear dropdown selector de estados para el administrador
      const selectHtml = `
        <select class="form-control admin-change-status-select" data-id="${order.id}" style="padding: 4px 8px; font-size: 0.8rem; height: auto; width: 140px; display: inline-block;">
          ${statusOptions.map(st => `
            <option value="${st}" ${order.status === st ? 'selected' : ''}>${st.replace('_', ' ').toUpperCase()}</option>
          `).join('')}
        </select>
      `;

      return `
        <tr>
          <td>#${order.id}</td>
          <td>
            <div style="font-size: 0.85rem; font-weight: 600;">${this.escape(order.client_name)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${this.escape(order.client_email)}</div>
          </td>
          <td>${date}</td>
          <td>${this.formatCurrency(order.final_amount)}</td>
          <td>${selectHtml}</td>
          <td>
            <a href="#orders/${order.id}" class="btn btn-secondary btn-sm"><i class="fa-solid fa-eye"></i> Detalle</a>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="tab-header">
        <h2>Gestión de Pedidos</h2>
      </div>
      
      <div class="card glass" style="padding: 12px;">
        <div class="orders-table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Total</th>
                <th>Estado (Cambiar)</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${orderRows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  /**
   * TAB ADMIN: Reembolsos
   */
  _renderAdminRefunds(refunds) {
    if (refunds.length === 0) {
      return `
        <div class="tab-header">
          <h2>Solicitudes de Reembolso</h2>
        </div>
        <div class="catalog-empty card glass">
          <i class="fa-solid fa-circle-check" style="color: var(--success);"></i>
          <h2>No hay reembolsos pendientes</h2>
          <p>Todas las solicitudes de reembolso han sido procesadas.</p>
        </div>
      `;
    }

    const refundRows = refunds.map(ref => {
      const reqDate = new Date(ref.requested_at).toLocaleDateString('es-CO', {
        year: 'numeric', month: 'short', day: 'numeric'
      });
      const isPending = ref.status === 'pending';

      return `
        <tr>
          <td>#${ref.id}</td>
          <td>Pedido #${ref.order_id} (${ref.tracking_number})</td>
          <td>
            <div style="font-size: 0.85rem; font-weight: 600;">${this.escape(ref.client_name)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${this.escape(ref.client_email)}</div>
          </td>
          <td>${this.formatCurrency(ref.final_amount)}</td>
          <td><span class="status-badge status-${ref.status}">${ref.status}</span></td>
          <td>
            <div style="max-width: 200px; font-size: 0.8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${this.escape(ref.reason)}">
              ${this.escape(ref.reason)}
            </div>
          </td>
          <td>
            ${isPending ? `
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-primary btn-sm admin-refund-approve-btn" data-id="${ref.id}" data-order="${ref.order_id}"><i class="fa-solid fa-check"></i> Aprobar</button>
                <button class="btn btn-danger btn-sm admin-refund-reject-btn" data-id="${ref.id}"><i class="fa-solid fa-xmark"></i> Rechazar</button>
              </div>
            ` : `
              <span class="text-muted" style="font-size: 0.8rem;">Procesado</span>
            `}
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="tab-header">
        <h2>Gestión de Reembolsos</h2>
      </div>
      
      <div class="card glass" style="padding: 12px;">
        <div class="orders-table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Motivo</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              ${refundRows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  /**
   * TAB ADMIN: Usuarios
   */
  _renderAdminUsers(users) {
    const userRows = users.map(user => {
      const date = new Date(user.created_at).toLocaleDateString('es-CO', {
        year: 'numeric', month: 'short', day: 'numeric'
      });
      const isAdminRole = user.role === 'admin';
      return `
        <tr>
          <td>#${user.id}</td>
          <td><strong style="color: ${isAdminRole ? 'var(--primary)' : 'inherit'};">${this.escape(user.full_name)}</strong></td>
          <td>${this.escape(user.email)}</td>
          <td><span class="status-badge ${isAdminRole ? 'status-delivered' : 'status-pending'}">${user.role}</span></td>
          <td><span style="text-transform: uppercase; font-size: 0.8rem; font-weight: 600;">${user.auth_provider}</span></td>
          <td>${date}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="tab-header">
        <h2>Cuentas de Usuarios</h2>
      </div>
      
      <div class="card glass" style="padding: 12px;">
        <div class="orders-table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Proveedor</th>
                <th>Fecha Registro</th>
              </tr>
            </thead>
            <tbody>
              ${userRows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
};
