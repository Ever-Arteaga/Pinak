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
  .firebaserc             # Alias dev/prod → proyecto pinak-dev
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
  `gemini-3.6-flash`, fijo; se cambia con `GEMINI_MODEL` en `functions/.env`) de forma segura — la API key
  nunca se expone en el cliente
- **La IA es exclusiva de los planes Pro y Premium** — el botón se oculta por
  completo para el plan gratuito (Emprendedor), y el bloqueo se refuerza también
  del lado del servidor (Cloud Function) por si alguien intenta saltarse la UI

## Planes

| | Emprendedor | Pro | Premium |
|---|---|---|---|
| Precio | Gratis | $39.900/mes | $69.900/mes |
| Movimientos, fiados y reportes | Sí | Sí | Sí |
| Registro por voz y texto con IA | — | Ilimitado | Ilimitado |
| Exportar reportes a PDF y Excel | — | Sí | Sí |
| Usuarios por negocio | 1 | 2 (dueño + 1) | Ilimitados |
| Negocios por cuenta | 1 | 1 | Ilimitados |
| Diagnóstico financiero mensual con IA | — | — | Sí |
| Modo privacidad (oculta montos) | — | — | Sí |

Los beneficios de un negocio los define el plan de **su dueño**; las personas invitadas los heredan.
Los límites los aplica el servidor (`functions/src/plans.ts`); `web/src/types/pinak.ts` solo los refleja en pantalla.

### Orden de despliegue (importante)

1. `firebase deploy --only functions` — primero, para que existan `ensureBusiness` y el resto.
2. `firebase deploy --only firestore:rules`
3. Publicar la web (`npm run deploy:hosting` o `git push` si usas Vercel).

## Configuración de Firebase

Proyecto: **pinak-dev** (alias `dev` y `prod` en `.firebaserc`; hoy es el mismo proyecto)

La URL de redirección de Bold en la app móvil se configura en `app.json` → `extra.boldRedirectUrl` y debe estar en la lista de dominios permitidos de `functions/src/payments.ts`.

1. Firebase Console → Authentication → Sign-in method → activa **Email/Password**
   y **Google**.
2. Firestore Database → si no existe, créala en modo producción.
3. Sube las reglas: `firebase deploy --only firestore:rules` (o pega el
   contenido de `firebase/firestore.rules` directo en la consola).
4. Configuración del proyecto → Tus apps → registra Web, Android e iOS si
   no existen (bundle/package sugerido: `com.ethereal.pinak`).

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
   Esto la publica en `https://pinak-dev.web.app` (o el dominio que
   configures). Si usas un dominio distinto, actualiza la constante
   `BOLD_REDIRECT_URL` en `mobile/src/lib/payments.ts`.
6. En el panel de Bold (Webhooks), registra la URL que te dio Firebase tras
   el deploy de functions:
   ```
   https://us-central1-pinak-dev.cloudfunctions.net/boldWebhook
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


## Resúmenes y App Check

- **Resúmenes agregados:** el trigger `onTransactionWritten` mantiene `businesses/{id}/summaries/{day-*|month-*|all}`. Tras desplegarlo, recalcula los datos existentes UNA vez: `cd functions` → `$env:GOOGLE_APPLICATION_CREDENTIALS="ruta\cuenta-de-servicio.json"` → `npm run backfill`. Opcional: política TTL de Firestore sobre `summaryEvents.expireAt` para limpiar eventos viejos.
- **App Check:** la web lo activa si defines `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY` (clave reCAPTCHA Enterprise registrada en Firebase → App Check). El servidor solo lo EXIGE si `APP_CHECK_ENFORCE=true` en `functions/.env`. No lo actives mientras la app móvil no envíe tokens (requiere `@react-native-firebase/app-check` y un build nativo): sus llamadas serían rechazadas.

## Borrado de cuenta y seguridad (Fase 4)

- **Eliminar cuenta**: Mi perfil → "Eliminar cuenta" (web y móvil). Llama a la función `deleteAccount`, que exige
  haber iniciado sesión hace menos de 5 minutos, escribir `ELIMINAR` y confirmar con contraseña. Borra los negocios
  propios (con movimientos, fiados, categorías y resúmenes), quita a la persona de negocios ajenos, borra sus
  invitaciones, su perfil, su historial de pagos y su usuario de acceso. Se despliega con
  `firebase deploy --only functions`.
- **Cabeceras**: `firebase.json` y `web/vercel.json` llevan CSP completa, `X-Frame-Options: DENY`, HSTS y
  `Permissions-Policy` (micrófono solo para la propia app, por el registro por voz).
- **Bundle ID / package**: `com.ethereal.pinak`. Si ya registraste apps con el nombre anterior en Firebase,
  registra de nuevo Android e iOS con el nuevo, descarga otra vez `google-services.json` y
  `GoogleService-Info.plist`, y actualiza tu `mobile/app.json`.
- **Dependencias**: `npm audit` queda sin vulnerabilidades críticas en `functions` y `web`. Lo que sigue
  apareciendo viene de la cadena de Expo/React Native (herramientas de compilación) y de paquetes de Node que
  el navegador no usa (`@grpc/grpc-js`); se resuelve al subir de versión de Expo.

## Código compartido (`shared/`)

Paquete `@pinak/shared` con lo que es idéntico en web y móvil y no depende de React ni de la plataforma:
tipos del dominio, `money`, `dates`, `months`, `filterCategoriesByType` y los totales/formatos de pesos
(`computeBalance`, `currency`, `dateFormatter`). Cada app lo usa como dependencia local
(`"@pinak/shared": "file:../shared"`), **sin npm workspaces**, así Vercel, `firebase deploy` y EAS Build
instalan igual que antes. Los archivos de `web/src/lib` y `mobile/src/lib` correspondientes solo lo reexportan,
por eso los imports de las pantallas no cambian.

- Probar: `cd shared && npm install && npm test`.
- Después de clonar o tras cambiar `shared/`: `npm install` en `web/` y en `mobile/` para enlazarlo.
- **Vercel**: en Settings → General, "Root Directory" = `web` y activa "Include source files outside of the Root Directory in the Build Step" (viene activo por defecto).
- **EAS Build (tiendas)**: ejecuta `eas build` desde `mobile/` con el proyecto dentro del repositorio git;
  EAS sube el repositorio completo, así `../shared` está disponible.
