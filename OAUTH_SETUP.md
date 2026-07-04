# AeroShop — Configuración OAuth (Google y Apple)

Guía para configurar inicio de sesión / registro con Google y Apple en **AeroShop** (Express + SQLite + SPA).

> **Puerto del proyecto:** `5000` (no 3000). Todas las URLs de callback usan `OAUTH_CALLBACK_BASE_URL`.

---

## 1. Variables de entorno (`.env`)

Copia desde `.env.example` y completa:

```env
PORT=5000
OAUTH_CALLBACK_BASE_URL=http://localhost:5000
FRONTEND_URL=http://localhost:5000
SESSION_SECRET=tu-secreto-largo-aleatorio
OAUTH_STATE_SECRET=otro-secreto-para-csrf-state

# Google
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-google-client-secret

# Apple (NO guardar client_secret estático — se genera JWT ES256 con la .p8)
APPLE_CLIENT_ID=tu.service.id
APPLE_TEAM_ID=tu-team-id
APPLE_KEY_ID=tu-key-id
APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
```

**Nunca** subas `.env` a Git ni hardcodees claves en el código.

---

## 2. URLs de callback (deben coincidir EXACTAMENTE)

| Proveedor | Redirect URI |
|-----------|----------------|
| Google | `http://localhost:5000/auth/google/callback` |
| Apple | `http://localhost:5000/auth/apple/callback` |

En producción reemplaza el host:

```
https://tu-dominio.com/auth/google/callback
https://tu-dominio.com/auth/apple/callback
```

Configura `OAUTH_CALLBACK_BASE_URL` y `PUBLIC_URL` con ese dominio.

---

## 3. Google Cloud Console

1. Abre [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Crea **OAuth 2.0 Client ID** → tipo **Web application**
3. **Authorized JavaScript origins:**
   - `http://localhost:5000`
   - `https://tu-dominio.com` (producción)
4. **Authorized redirect URIs:**
   - `http://localhost:5000/auth/google/callback`
5. Copia **Client ID** → `GOOGLE_CLIENT_ID`
6. Copia **Client secret** → `GOOGLE_CLIENT_SECRET`

---

## 4. Apple Developer

1. Abre [Apple Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list)
2. Crea un **Services ID** → habilita **Sign in with Apple**
3. **Return URLs:**
   - `http://localhost:5000/auth/apple/callback` (solo con túnel HTTPS en dev)
   - `https://tu-dominio.com/auth/apple/callback` (producción)
4. Crea una **Key** (.p8) con Sign in with Apple habilitado
5. Anota **Team ID**, **Key ID**, **Services ID** (client id)
6. Pega el contenido del `.p8` en `APPLE_PRIVATE_KEY` (saltos de línea como `\n`)

El **client_secret de Apple** se genera **dinámicamente** en cada intercambio de token (JWT ES256 firmado con la `.p8`). Ver `backend/services/appleClientSecretService.js`.

---

## 5. Seguridad implementada

| Medida | Implementación |
|--------|----------------|
| Anti-CSRF (`state`) | JWT firmado en `oauthStateService.js`, validado en `oauthStateMiddleware.js` antes del callback |
| Sin secretos en código | Todo desde `process.env` |
| Apple client_secret | JWT ES256 dinámico (passport-apple + `appleClientSecretService.js`) |
| Sesión OAuth | `express-session` + Passport |

---

## 6. Comandos para levantar el proyecto

```powershell
cd "C:\Users\dlvc5\Downloads\Proyecto(1)\Proyecto"
npm start
```

Abre: **http://localhost:5000**

Si el puerto está ocupado (`EADDRINUSE`):

```powershell
netstat -ano | findstr :5000
taskkill /PID <numero> /F
npm start
```

Pruebas automatizadas:

```powershell
cd backend
npm test
npm run test:oauth
```

---

## 7. Cómo probar login con Google (local)

1. Completa `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en `.env`
2. Registra `http://localhost:5000/auth/google/callback` en Google Cloud
3. `npm start`
4. Ve a `http://localhost:5000/#login`
5. Clic en **Continuar con Google**
6. Autoriza en Google → vuelves a `#oauth/callback` → sesión iniciada

---

## 8. Cómo probar login con Apple

**Importante:** Apple Sign In exige **HTTPS** en dominios reales. En `localhost` plano suele fallar.

### Opción A — Producción con HTTPS

Despliega en Render/Vercel con HTTPS y configura las Return URLs con tu dominio.

### Opción B — Desarrollo local con túnel HTTPS

#### Con Cloudflare Tunnel (cloudflared)

```powershell
# Instalar: winget install Cloudflare.cloudflared
cloudflared tunnel --url http://localhost:5000
```

1. Copia la URL HTTPS que te da (ej. `https://abc.trycloudflare.com`)
2. En `.env`:
   ```env
   OAUTH_CALLBACK_BASE_URL=https://abc.trycloudflare.com
   FRONTEND_URL=https://abc.trycloudflare.com
   ```
3. En Apple Developer y Google Cloud, usa:
   - `https://abc.trycloudflare.com/auth/apple/callback`
   - `https://abc.trycloudflare.com/auth/google/callback`
4. Reinicia `npm start` y abre la URL del túnel

#### Con ngrok

```powershell
ngrok http 5000
```

Mismo procedimiento con la URL `https://xxxx.ngrok-free.app`.

### Flujo de prueba Apple

1. Variables `APPLE_*` completas en `.env`
2. Túnel HTTPS activo y callbacks registrados en Apple
3. `http://localhost:5000/#login` (o URL del túnel) → **Continuar con Apple**
4. **Primera vez:** autoriza compartir email (Apple lo envía en el JWT)
5. **Siguientes veces:** Apple solo envía `sub`; el backend reconoce la cuenta por `provider_id`

---

## 9. Rutas de la API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/auth/google` | Inicia OAuth Google |
| GET | `/auth/google/callback` | Callback Google |
| GET | `/auth/apple` | Inicia OAuth Apple |
| POST | `/auth/apple/callback` | Callback Apple (form_post) |
| GET | `/auth/me` | Perfil (Bearer token) |

Alias: mismas rutas bajo `/api/auth/*`.

---

## 10. Solución de problemas

| Error | Causa | Solución |
|-------|-------|----------|
| `redirect_uri_mismatch` | URI no registrada o distinta | Igualar consola y `OAUTH_CALLBACK_BASE_URL` |
| `Estado OAuth inválido` | CSRF / state expirado | Reintentar login (state dura 15 min) |
| `EADDRINUSE :5000` | Servidor ya corriendo | `taskkill` o Ctrl+C |
| Apple no abre en local | Requiere HTTPS | Usar cloudflared o ngrok |
| Apple sin email en 2.º login | Comportamiento normal | Cuenta se busca por `provider_id` (sub) |