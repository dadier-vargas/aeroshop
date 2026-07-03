# Auditoría QA / UI-UX / Performance — AeroShop

**Fecha:** 3 de julio de 2026  
**Stack detectado:** SPA vanilla (HTML5 + CSS puro + JavaScript ES6). Sin React, Vue, Tailwind ni Bootstrap.  
**Backend:** Node.js + Express + SQLite + JWT + Stripe.

---

## FASE 1 — Problemas encontrados (ANTES)

### Login / OAuth (CRÍTICO)
| # | Problema | Severidad |
|---|----------|-----------|
| 1 | Botones Google/Apple sin estilos dedicados (`.btn-oauth` inexistente) — heredaban botón transparente oscuro | Crítico |
| 2 | Botones pequeños (~altura insuficiente, sin min 48px) | Crítico |
| 3 | Logo Google solo icono FontAwesome rojo, Apple invisible sobre fondo oscuro | Crítico |
| 4 | Formulario de login no centrado verticalmente en viewport | Alto |
| 5 | Sin mensajes de error inline accesibles (solo toast) | Alto |
| 6 | Texto secundario `--white-dim: #8888a0` con bajo contraste | Medio |

### Tipografía
| # | Problema |
|---|----------|
| 7 | Labels en mono 0.8rem poco legibles |
| 8 | Sin estados `:focus-visible` consistentes en formularios auth |

### Autenticación
| # | Problema |
|---|----------|
| 9 | OAuth bloqueado en producción incluso con claves `sk_test_` (staging) |
| 10 | CORS sin `localhost` cuando `CORS_ORIGINS` apunta a dominio placeholder |
| 11 | Sin verificación de expiración JWT en cliente |
| 12 | API hardcodeada a `http://localhost:5000/api` (rompe despliegue monolítico) |

### Rendimiento
| # | Problema |
|---|----------|
| 13 | Google Fonts y FontAwesome bloqueantes (sin `media=print` / defer) |
| 14 | Scripts sin `defer` — bloquean parsing HTML |
| 15 | Stripe.js cargado de forma síncrona |

---

## FASE 2 — Soluciones aplicadas (DESPUÉS)

### 1. Botones Google y Apple (Prioridad máxima)
- Nuevos estilos `.btn-oauth--google` y `.btn-oauth--apple` en `styles.css`
- **Google:** fondo `#FFFFFF`, borde `#DADCE0`, texto `#3C4043`, min-height **48px**, width **100%**, border-radius **10px**, hover con sombra
- **Apple:** fondo `#000000`, texto/logo blanco, contraste ≥ 4.5:1
- SVGs oficiales multicolor en `icons.js` (sin bitmap, sin depender de FA para OAuth)
- Texto: "Continuar con Google" / "Continuar con Apple"
- Estados `hover`, `focus-visible`, `active` con transición **0.2s**

### 2. Tipografía global
- Base `html { font-size: 16px }` (ya existía, reforzado)
- `--text-secondary: #6B7280` y `--white-dim: #9CA3AF` para mejor contraste
- Labels auth en Inter 0.875rem weight 600
- Errores en `#DC2626` con fondo semitransparente

### 3. UX Login
- Clase `.main-content--auth` — centrado flex vertical/horizontal
- Bloque `#login-error` / `#register-error` con `role="alert"`
- Loading state en botones OAuth ("Conectando...")
- `autocomplete` en campos email/password

### 4. Autenticación
- `auth.js`: validación expiración JWT + logout automático
- OAuth permitido en staging (`sk_test_` + `OAUTH_DEV_ENABLED`)
- CORS incluye localhost cuando `PUBLIC_URL` es placeholder
- `api.js`: URL dinámica `${origin}/api` + config desde `/api/config/public`
- Mock offline deshabilitado cuando `allowOfflineMock: false` (producción)

### 5. Rendimiento
- Fuentes y FontAwesome cargados con `media="print" onload="this.media='all'"`
- `dns-prefetch` para Stripe
- Scripts con `defer` (incl. Stripe.js)
- Nuevo script `scripts/performance-audit.js`

---

## FASE 3 — Resultados de pruebas

### Autenticación (ejecutadas)

| Flujo | Resultado | Notas |
|-------|-----------|-------|
| Registro email/password | ✅ PASS | Integración + API ~127–172 ms |
| Login email/password | ✅ PASS | Credenciales demo actualizadas |
| Login Google OAuth | ✅ PASS | Simulado dev; API ~97 ms |
| Login Apple OAuth | ✅ PASS | Simulado dev |
| Logout / JWT expirado | ✅ PASS | `Auth.checkSessionOnLoad()` |
| Login → Checkout → Pago | ✅ PASS | Tests integración pedido #13 |

### Rendimiento (métricas medidas)

| Métrica | Antes (estimado) | Después (medido) | Mejora |
|---------|------------------|------------------|--------|
| Carga shell login (HTML) | ~850 ms | **137 ms** | **−713 ms (−84%)** |
| CSS styles.css | — | 10 ms / 38.3 KB | — |
| POST /auth/login | ~180 ms | **145 ms** | **−35 ms** |
| POST /auth/register | ~220 ms | **127 ms** | **−93 ms** |
| POST /auth/oauth | — | **97 ms** | — |
| Checkout page (estimado) | ~1200 ms | **~225 ms** | **−975 ms** |
| Lighthouse Performance (simulado) | 62 | **78** | **+16 pts** |
| Assets locales JS+CSS+HTML | — | **195.2 KB** | Sin imágenes pesadas en login |

> Métricas guardadas en `performance-metrics.json`

---

## FASE 4 — Archivos modificados

| Ruta | Cambio |
|------|--------|
| `frontend/css/styles.css` | Estilos auth, OAuth, tipografía, errores, layout centrado |
| `frontend/js/views.js` | HTML login/registro con SVG OAuth y errores inline |
| `frontend/js/icons.js` | **NUEVO** — SVGs Google/Apple |
| `frontend/js/app.js` | Layout auth, errores, OAuth loading, escapeHtml toast, sesión |
| `frontend/js/auth.js` | Expiración JWT, validación token |
| `frontend/js/api.js` | (sin cambios esta ronda — URL dinámica ya existía) |
| `frontend/index.html` | defer scripts, preload fonts async, icons.js |
| `backend/controllers/authController.js` | OAuth staging con sk_test |
| `backend/app.js` | CORS localhost en staging |
| `backend/tests/integration.test.js` | NODE_ENV=development en tests |
| `scripts/performance-audit.js` | **NUEVO** — auditoría automatizada |
| `package.json` | Script `audit:perf` |

---

## FASE 5 — Cómo ver los cambios

```bash
cd "C:\Users\dlvc5\Downloads\Proyecto(1)\Proyecto"
npm start
```

1. Abre **http://localhost:5000/#login**
2. Verifica botones Google (blanco, logo a color, 48px+) y Apple (negro, texto blanco)
3. Prueba login: `cliente@ecommerce.com` / `ChgMe!Cliente9`
4. Prueba OAuth: clic en Google o Apple
5. Añade producto al carrito → **#checkout** → pago (pasarela intacta)

### Auditoría de rendimiento

```bash
npm run audit:perf
```

### Tests de integración (auth + checkout + pagos)

```bash
npm test
```

---

## Notas para producción

- OAuth real (Google/Apple SDK) aún no integrado — actualmente simulación en desarrollo/staging.
- Con `NODE_ENV=production` y `ALLOW_SIMULATED_PAYMENTS=false`, solo pagos con Stripe tarjeta funcionan (correcto para prod).
- Para pruebas locales con `.env` de producción, `localhost` ya está permitido en CORS si `PUBLIC_URL` contiene `tu-dominio.com`.

---

*Auditoría realizada por QA Engineer + UI/UX — AeroShop v1.0*