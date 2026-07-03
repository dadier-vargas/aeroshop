# Desplegar AeroShop en Render (gratis)

## Requisitos previos

1. Cuenta en [Render](https://render.com) (gratis con GitHub)
2. Repositorio Git en GitHub con este proyecto
3. Claves Stripe **test**: [dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys)

---

## Paso 1 — Subir a GitHub

En la carpeta del proyecto (`Proyecto`):

```powershell
# Verificar que todo pasa
npm test

# Si aún no tienes remote:
git remote add origin https://github.com/TU_USUARIO/aeroshop.git
git branch -M main
git push -u origin main
```

> **Importante:** El archivo `.env` **no** se sube (está en `.gitignore`). Las claves van en el panel de Render.

También puedes ejecutar el checklist automático:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-render.ps1
```

---

## Paso 2 — Crear el servicio en Render

### Opción A — Blueprint automático (recomendado)

1. [Render Dashboard](https://dashboard.render.com) → **New → Blueprint**
2. Conecta tu cuenta de GitHub y selecciona el repositorio
3. Render leerá `render.yaml` y creará el servicio + disco persistente
4. Completa las variables marcadas como `sync: false` (ver tabla abajo)
5. Click **Apply** y espera el build (~2-5 min)

### Opción B — Manual

1. **New → Web Service** → conecta el repo
2. Configuración:

| Campo | Valor |
|-------|-------|
| Runtime | Node |
| Build Command | `npm install --omit=dev` |
| Start Command | `npm start` |
| Plan | Free |

3. **Add Disk** (obligatorio para SQLite):
   - Mount Path: `/var/data`
   - Size: 1 GB

4. Variables de entorno (ver tabla)

5. **Create Web Service**

---

## Paso 3 — Variables de entorno en Render

| Variable | Valor ejemplo | Notas |
|----------|---------------|-------|
| `NODE_ENV` | `production` | Ya en render.yaml |
| `HOST` | `0.0.0.0` | Ya en render.yaml |
| `DATABASE_PATH` | `/var/data/ecommerce.db` | Ya en render.yaml |
| `JWT_SECRET` | *(auto-generado)* | render.yaml usa `generateValue` |
| `STRIPE_SECRET_KEY` | `sk_test_...` | **Tú lo completas** |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_...` | **Tú lo completas** |
| `PUBLIC_URL` | `https://aeroshop-xxxx.onrender.com` | URL real de tu app |
| `CORS_ORIGINS` | `https://aeroshop-xxxx.onrender.com` | Misma URL |
| `SEED_DEMO_USERS` | `true` | Solo primer deploy |
| `ALLOW_SIMULATED_PAYMENTS` | `false` | Ya en render.yaml |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Opcional en test |

> Tras el primer deploy exitoso, cambia `SEED_DEMO_USERS` a `false`.

---

## Paso 4 — Verificar el deploy

1. Abre `https://tu-app.onrender.com/api/health` → debe responder `{"status":"healthy"}`
2. Abre `https://tu-app.onrender.com` → catálogo cargando
3. Login demo (si `SEED_DEMO_USERS=true`):
   - `cliente@ecommerce.com` / `ChgMe!Cliente9`
4. Prueba pago: tarjeta `4242 4242 4242 4242`, exp `12/34`, CVC `123`
5. Prueba el botón de **tema claro/oscuro** (icono sol/luna en la barra lateral)

---

## Webhook Stripe (opcional)

1. Stripe Dashboard → Webhooks → Add endpoint
2. URL: `https://tu-app.onrender.com/api/webhooks/stripe`
3. Eventos: `payment_intent.succeeded`, `payment_intent.payment_failed`
4. Copia `whsec_...` → `STRIPE_WEBHOOK_SECRET` en Render → **Manual Deploy**

---

## Notas importantes

- **Plan free**: la app se duerme tras ~15 min sin visitas (primer acceso tarda ~30s).
- **SQLite + Disco**: sin disco adjunto, los pedidos se pierden al redeploy.
- Para cobros reales cambia a claves `sk_live_` / `pk_live_`.
- Si el build falla, revisa los logs en Render → Events.

---

## Comandos útiles

```bash
npm test                  # tests de integración
npm run validate:prod     # validar .env de producción local
npm start                 # servidor local
```