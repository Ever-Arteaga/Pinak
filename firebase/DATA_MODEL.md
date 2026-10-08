# PINAK — Modelo de Datos (Firestore)

## Estructura general

```
users/{userId}                      ← la CUENTA de la persona (quien se registra y paga)
  ├── email, businessName (nombre inicial), createdAt
  ├── plan, planStartedAt, planExpiresAt   ← solo los escriben las Cloud Functions (pagos de Bold)
  ├── privacyModeEnabled                    ← preferencia personal (solo aplica en negocios Premium)
  └── payments/{paymentId}                  ← historial de pagos (solo lectura desde la app)

businesses/{businessId}             ← un NEGOCIO y su equipo
  ├── name, businessType, phone, city, nit, description   ← los edita el dueño
  ├── ownerId                                              ← quien lo creó y paga
  ├── memberIds: [uid, ...]         ← incluye al dueño; las reglas de seguridad lo usan
  ├── members: { uid: { role: "owner"|"member", email, joinedAt } }
  ├── plan                          ← copia del plan del DUEÑO (la mantienen las Cloud Functions)
  ├── locked                        ← true si el plan del dueño venció y el negocio ya no cabe
  ├── createdAt
  ├── transactions/{transactionId}  ← ingresos y egresos
  ├── receivables/{receivableId}    ← fiados
  ├── categories/{categoryId}
  ├── usage/{YYYY-MM}               ← contador de registros con IA (solo Cloud Functions)
  └── diagnostics/{YYYY-MM}         ← diagnóstico financiero mensual (solo Cloud Functions)

invitations/{invitationId}          ← invitaciones a unirse a un negocio (solo Cloud Functions)
  └── businessId, businessName, email (minúsculas), invitedByUid, invitedByEmail,
      status: "pendiente" | "aceptada" | "rechazada", createdAt

checkoutIntents/{orderId}           ← órdenes de pago de Bold (solo Cloud Functions)
```

## Reglas de negocio clave

- **El plan lo define el dueño.** Las personas invitadas heredan los beneficios del plan del
  dueño dentro de ese negocio (IA, exportaciones, diagnóstico, privacidad).
- **Límites** (los aplican las Cloud Functions, ver `functions/src/plans.ts`):

  | Plan | Usuarios por negocio | Negocios | IA | Exportar | Diagnóstico |
  |---|---|---|---|---|---|
  | Emprendedor | 1 | 1 | No | No | No |
  | Pro | 2 (dueño + 1) | 1 | Sí | Sí | No |
  | Premium | Ilimitados | Ilimitados | Sí | Sí | Sí |

- El primer negocio de cada cuenta tiene `businessId == userId` (lo crea `ensureBusiness`).
  Las cuentas anteriores a los equipos tenían sus datos en `users/{uid}/transactions|receivables|categories`:
  `ensureBusiness` los copia al negocio la primera vez (los originales no se borran).
- Al vencer un plan, `downgradeExpiredPlans` baja al dueño a Emprendedor y llama a
  `syncBusinessPlans`: conserva el negocio más antiguo, **bloquea** los demás (`locked: true`,
  sin perder datos) y quita al equipo que ya no cabe (las personas más recientes primero).
  Al renovar, todo se desbloquea.
- Las invitaciones se aceptan solo con el **correo verificado** y deben coincidir con el correo invitado.
- Cada `amount` debe ser positivo; el signo lo da `type`.
- Las fechas de los diagnósticos se calculan en hora de Colombia (UTC-5).
- El diagnóstico se limita a 3 generaciones por negocio y mes (control de costo de la IA).

## Seguridad (firebase/firestore.rules)

- `users`: la persona solo puede cambiar `businessName`, `businessType`, `phone`, `city`, `nit`,
  `description` y `privacyModeEnabled`. Nunca el plan ni su vencimiento.
- `businesses`: lectura solo para los miembros; el dueño edita únicamente los datos descriptivos.
  Crear negocios y cambiar miembros solo se puede desde Cloud Functions.
- Subcolecciones del negocio: acceso solo a miembros **y** si el negocio no está bloqueado.

## Índices compuestos sugeridos

- `transactions`: `date DESC` + `type ASC`
- `transactions`: `category ASC` + `date DESC`
