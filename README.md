# PINAK

Asistente financiero con IA para mipymes. Proyecto de **Ethereal Marketing LLC**
(Yeffry Yardanis Cantero Ariza & Ever Luis Arteaga González).

## Estructura del repo

```
pinak/
  firebase/
    firestore.rules      # Reglas de seguridad de Firestore
    DATA_MODEL.md         # Esquema de datos documentado
  functions/              # Cloud Functions (Fase 3: registro por IA con Gemini)
  web/                    # Next.js 15 + TypeScript + Tailwind (export estático)
  mobile/                 # Expo SDK 54 (React Native) + TypeScript
  firebase.json           # Config del Firebase CLI
  .firebaserc             # Referencia al proyecto pinak-cd2e4
```

## Qué incluye

### Fase 1 — MVP Base
- Autenticación (email/password + Google Sign-in) con Firebase Auth
- Motor de ingresos/egresos en tiempo real (Firestore)
- Dashboard: balance total, resumen de ingresos/egresos, movimientos recientes
- Plan gratuito ("Emprendedor") habilitado por defecto, categorías por defecto

### Fase 2 — Fiados y reportes
- Módulo de fiados (cuentas por cobrar) con cobro por WhatsApp en 1 clic
- Transacciones y fiados **editables y eliminables**, con confirmación antes de borrar
- Selector de categorías (con opción de crear una nueva sobre la marcha)
- Exportación de reportes a PDF y Excel, con filtro por rango de fechas
- Headers con navegación consistente (atrás / cerrar sesión)

### Fase 3 — Registro por voz/texto con IA
- Botón "✨ Registrar con IA": escribe o dicta (con el micrófono nativo del
  teclado) algo como *"Vendí 60.000 en Nequi y gasté 15.000 en insumos en
  efectivo"* y la app detecta los movimientos, los muestra editables, y los guarda
- Cloud Function (`functions/`) que llama a **Google Gemini** (alias
  `gemini-flash-latest`, con cuota gratuita) de forma segura — la API key
  nunca se expone en el cliente
- **La IA es exclusiva de los planes Pro y Premium** — el botón se oculta por
  completo para el plan gratuito (Emprendedor), y el bloqueo se refuerza también
  del lado del servidor (Cloud Function) por si alguien intenta saltarse la UI

## Planes

| Plan | Precio | IA por voz/texto | Usuarios | Negocios |
|---|---|---|---|---|
| Emprendedor | Gratis | ❌ No disponible | 1 | 1 |
| Pro | $39.900 COP/mes | ✅ Ilimitada | Hasta 2 | 1 |
| Premium | $69.900 COP/mes | ✅ Ilimitada | Ilimitados | Multi-negocio |

**Roadmap de diferenciación para Premium** (aún no implementado en código):
- Modo privacidad en pantalla (oculta saldos frente a clientes/empleados)
- Diagnóstico financiero mensual automatizado con IA
- Multi-negocio / multi-sede
- Roles y permisos (admin / cajero)
- Reportes con marca propia del negocio

> **Nota**: se eligió Gemini (en vez de Claude) para esta fase por su nivel
> gratuito real. La Cloud Function está aislada del resto del código
> (`functions/src/index.ts`), así que cambiar de proveedor de IA más adelante
> es un cambio acotado.

## Configuración de Firebase

Proyecto: **pinak-cd2e4**

1. Firebase Console → Authentication → Sign-in method → activa **Email/Password**
   y **Google**.
2. Firestore Database → si no existe, créala en modo producción.
3. Sube las reglas: `firebase deploy --only firestore:rules` (o pega el
   contenido de `firebase/firestore.rules` directo en la consola).
4. Configuración del proyecto → Tus apps → registra Web, Android e iOS si
   no existen (bundle/package sugerido: `Pinak.Ethereal.com`).

### Web

```
cd web
cp .env.local.example .env.local
# Llena .env.local con las credenciales de tu app web de Firebase
npm install
npm run dev
```

Para exportar como HTML/CSS/JS estático (sin servidor):
```
npm run build
# genera la carpeta out/ con archivos estáticos puros
```

### Móvil

Copia `app.json.example` → `app.json`, `google-services.json.example` →
`google-services.json` y `GoogleService-Info.plist.example` →
`GoogleService-Info.plist`, y llena cada uno con tus credenciales reales.

```
cd mobile
npm install
npx expo start --tunnel
```

Escanea el QR con **Expo Go** (usa `--tunnel` si estás en Codespaces).

### Cloud Function de IA (Gemini)

```
cd functions
firebase functions:secrets:set GEMINI_API_KEY
# Pega tu key de aistudio.google.com/apikey SOLO cuando te la pida (nunca en el comando)
npm install
firebase deploy --only functions
```

La primera vez puede pedirte activar el plan **Blaze** de Firebase — sigue
siendo $0 mientras no superes las cuotas gratis.

### Cloud Functions de pago (Wompi) — upgrade de plan

Implementa el flujo real de cobro para pasar de Emprendedor a Pro/Premium,
usando [Wompi](https://wompi.co) (la pasarela más usada en Colombia — Nequi,
PSE, tarjetas, operada por Bancolombia).

**Cómo funciona:**
1. El usuario toca "Actualizar a Pro/Premium" → `createUpgradeCheckout`
   genera una URL de checkout de Wompi firmada (monto + referencia
   codificando `uid` y plan).
2. El usuario paga en la página de Wompi.
3. Wompi notifica el resultado al endpoint `wompiWebhook`, que verifica la
   firma del evento y, si fue aprobado, actualiza `users/{uid}.plan` con
   permisos de administrador (el cliente nunca puede cambiar su propio plan
   — ver `firebase/firestore.rules`).
4. `downgradeExpiredPlans` corre una vez al día y regresa a Emprendedor a
   quien no renovó su plan pago (vencimiento a los 30 días).

**Configuración:**

1. Crea una cuenta en [comercios.wompi.co](https://comercios.wompi.co).
   Para producción piden NIT/Cámara de Comercio; mientras tanto, usa las
   **llaves de sandbox** (gratis, sin verificación, con tarjetas de prueba)
   para desarrollar y probar todo el flujo.
2. En el panel de Wompi, copia: la **llave pública** (`pub_test_...` o
   `pub_prod_...`), el **secreto de integridad** ("Integrity" — firma los
   checkouts) y el **secreto de eventos** ("Events" — firma los webhooks).
3. Guárdalos como secretos de Firebase:
   ```
   cd functions
   firebase functions:secrets:set WOMPI_PUBLIC_KEY
   firebase functions:secrets:set WOMPI_INTEGRITY_SECRET
   firebase functions:secrets:set WOMPI_EVENTS_SECRET
   ```
4. Despliega: `firebase deploy --only functions`
5. En el panel de Wompi (Eventos/Webhooks), registra la URL del webhook.
   Firebase te la da después del deploy — se ve algo así:
   ```
   https://us-central1-pinak-cd2e4.cloudfunctions.net/wompiWebhook
   ```

**Roadmap pendiente** (no implementado aún):
- Cobro automático recurrente (hoy la renovación es manual cada 30 días —
  automatizarla requiere tokenizar el método de pago, una integración más
  avanzada con Wompi)
- Recordatorio antes del vencimiento del plan
- Historial de facturación visible para el usuario dentro de la app
## Notas técnicas importantes

- **Versión de Expo**: fijada a SDK 54 para que coincida con Expo Go. Si
  actualizas dependencias de Expo, verifica que sigan siendo compatibles
  con la versión de Expo Go instalada en tu celular.
- **expo-file-system** usa la API moderna basada en clases (`File`, `Paths`),
  no el `FileSystem.cacheDirectory` legado.
- **base64-js** se agrega explícitamente porque Hermes (motor JS de React
  Native) no expone `btoa` de forma nativa.
- En Codespaces, `firebase login` requiere el flag `--no-localhost`.
- Nunca subas `google-services.json`, `GoogleService-Info.plist`,
  `mobile/app.json` ni `web/.env.local` — están en `.gitignore` a propósito.
