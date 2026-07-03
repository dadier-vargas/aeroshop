# Plan de Pruebas - Integración Stripe (Sandbox)

## Configuración previa (obligatoria)

1. Obtén tus **claves de prueba**:
   - Ve a https://dashboard.stripe.com/test/apikeys
   - Copia `pk_test_...` y `sk_test_...`
   - Reemplaza en el archivo `.env` (copia desde `.env.example`)

2. Para webhooks locales (recomendado):
   ```bash
   # Instala Stripe CLI (una vez)
   # Luego:
   stripe login
   stripe listen --forward-to localhost:5000/api/webhooks/stripe
   ```
   Copia el `whsec_...` que muestra en consola y ponlo en `STRIPE_WEBHOOK_SECRET` del `.env`

3. Levanta el proyecto (ver instrucciones finales).

---

## Tarjetas de Prueba Oficiales de Stripe (Test Mode)

### Pagos EXITOSOS
| Tarjeta              | Expiry   | CVC  | Resultado esperado                  |
|----------------------|----------|------|-------------------------------------|
| 4242 4242 4242 4242  | 12/34    | 123  | Pago exitoso (succeeded)            |
| 4000 0025 0000 3155  | 12/34    | 123  | Requiere autenticación 3DS (aprobar en modal Stripe) |
| 5555 5555 5555 4444  | 12/34    | 123  | Mastercard exitosa                  |

### Pagos que FALLAN (declinados)
| Tarjeta              | Expiry   | CVC  | Motivo / Mensaje esperado                    |
|----------------------|----------|------|----------------------------------------------|
| 4000 0000 0000 9995  | 12/34    | 123  | `card_declined` - fondos insuficientes       |
| 4100 0000 0000 0019  | 12/34    | 123  | `card_declined` - tarjeta declinada genérica |
| 4000 0000 0000 0002  | 12/34    | 123  | `card_declined`                              |

### Otros casos
- Usa cualquier fecha futura (MM/YY)
- CVC de 3 o 4 dígitos

---

## Flujo de Prueba Paso a Paso (UI)

1. Inicia sesión con `cliente@ecommerce.com` / `ChgMe!Cliente9` (ver `.env.example`)
2. Agrega productos al carrito.
3. Ve al carrito → "Proceder al Pago"
4. Completa Paso 1 (envío).
5. Paso 2: selecciona **Tarjeta**
6. Rellena el formulario de tarjeta con datos de arriba (o usa la visual 3D).
7. Pulsa **"Pagar de Forma Segura"**
8. Observa el modal de procesamiento.
9. **Éxito esperado**: Modal verde + vista de éxito + pedido en "Mis Pedidos" con estado `paid`.
10. **Fallo esperado**: Modal rojo + mensaje claro + stock devuelto automáticamente.

## Pruebas de Webhook (avanzado)

- Con Stripe listen corriendo:
  - Realiza un pago exitoso.
  - En la consola del `stripe listen` verás el evento `payment_intent.succeeded`.
  - El pedido debe actualizarse vía webhook incluso si la confirmación del cliente falla (escenario de respaldo).

## Verificación manual del estado

Usa el endpoint (requiere login):
```
GET /api/payments/status/pi_XXXXXXXXXXXXXXXX
```

O revisa en el Dashboard de Stripe (Test mode) los Payment Intents creados.

## Pruebas de Métodos Alternativos (PSE / Wallet)

Estos continúan usando la simulación legacy:
- PSE con banco "Banco de Rechazo" → falla
- Wallet con OTP `0000` → falla
- Otros → éxito

## Errores comunes y soluciones

- `Stripe not defined` → Asegúrate de que el `<script src="https://js.stripe.com/v3/"></script>` esté cargado.
- Clave `pk_test_placeholder` → Revisa que `.env` tenga `STRIPE_PUBLISHABLE_KEY` correcta y el servidor se reinició.
- Webhook rechaza firma → Asegúrate de usar el secreto exacto que da `stripe listen`.
- `Invalid API Key` → Confirma que uses `sk_test_` (no live).

## Pruebas automatizadas existentes

El archivo `backend/tests/integration.test.js` sigue funcionando. Puedes extenderlo con casos de Stripe.

---

**Recordatorio de seguridad**: 
- Nunca uses tarjetas reales.
- Nunca hardcodees claves reales.
- En producción siempre usa HTTPS + Stripe Elements (no inputs manuales de PAN).
