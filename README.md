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

### Cloud Functions de pago (Bold) — upgrade de plan

Implementa el flujo real de cobro para pasar de Emprendedor a Pro/Premium,
usando [Bold](https://bold.co) (pasarela colombiana — Nequi, PSE, tarjetas).

**Cómo funciona:**
1. El usuario toca "Actualizar a Pro/Premium" → `createBoldCheckout` genera
   los datos firmados del checkout (monto, `orderId` único, firma de
   integridad) y guarda una "intención de compra" en Firestore
   (`checkoutIntents/{orderId}`) con el `uid` y el plan.
2. **Web**: se carga el script de Bold y se abre el checkout con el
   constructor `new BoldCheckout({...}).open()` (mantiene nuestro propio
   diseño de botón). **Móvil**: como Bold funciona con un script JS —no con
   una URL directa—, se abre dentro de un `WebView` (`react-native-webview`)
   que carga una página mínima con ese mismo script.
3. El usuario paga en la interfaz de Bold.
4. Bold notifica el resultado al endpoint `boldWebhook`, que verifica la
   firma HMAC del evento, busca la intención de compra por `orderId`, valida
   que el monto pagado coincida, y actualiza `users/{uid}.plan` con permisos
   de administrador (el cliente nunca puede cambiar su propio plan — ver
   `firebase/firestore.rules`).
5. `downgradeExpiredPlans` corre una vez al día y regresa a Emprendedor a
   quien no renovó su plan pago (vencimiento a los 30 días).

**Configuración:**

1. Crea una cuenta en el [Panel de Comercios de Bold](https://panel.bold.co).
   Para producción piden NIT/Cámara de Comercio; mientras tanto, usa el
   **modo pruebas** (sandbox) para desarrollar y probar todo el flujo.
2. En el panel, sección "Botón de pagos" → "Llaves de integración", copia:
   la **llave de identidad** (pública) y la **llave secreta** (privada —
   firma los checkouts y los webhooks).
3. Guárdalas como secretos de Firebase:
   ```
   cd functions
   firebase functions:secrets:set BOLD_IDENTITY_KEY
   firebase functions:secrets:set BOLD_SECRET_KEY
   ```
4. Despliega las funciones: `firebase deploy --only functions`
5. Publica la web en Firebase Hosting (necesario porque Bold exige que la
   URL de redirección sea `https://`, y el checkout en móvil usa esa misma
   URL para saber cuándo cerrarse):
   ```
   cd web && npm run build && cd ..
   firebase deploy --only hosting
   ```
   Esto la publica en `https://pinak-cd2e4.web.app` (o el dominio que
   configures). Si usas un dominio distinto, actualiza la constante
   `BOLD_REDIRECT_URL` en `mobile/src/lib/payments.ts`.
6. En el panel de Bold (Webhooks), registra la URL que te dio Firebase tras
   el deploy de functions:
   ```
   https://us-central1-pinak-cd2e4.cloudfunctions.net/boldWebhook
   ```

**Roadmap pendiente** (no implementado aún):
- Cobro automático recurrente (hoy la renovación es manual cada 30 días —
  automatizarla requiere tokenizar el método de pago, una integración más
  avanzada con Bold)
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
