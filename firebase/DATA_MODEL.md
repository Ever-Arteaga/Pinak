# PINAK — Modelo de Datos (Firestore)

## Estructura general

```
users/{userId}
  ├── email: string
  ├── businessName: string
  ├── businessType: string
  ├── plan: "emprendedor" | "estandar" | "pro"
  ├── planStartedAt: timestamp
  ├── createdAt: timestamp
  ├── privacyModeEnabled: boolean
  │
  ├── transactions/{transactionId}
  │     ├── type: "ingreso" | "egreso"
  │     ├── amount: number
  │     ├── category: string
  │     ├── method: "efectivo" | "nequi" | "daviplata" | "tarjeta" | "transferencia"
  │     ├── description: string
  │     ├── date: timestamp
  │     ├── source: "manual" | "ia_voz" | "ia_texto"
  │     └── createdAt: timestamp
  │
  ├── categories/{categoryId}
  │     ├── name: string
  │     ├── type: "ingreso" | "egreso"
  │     ├── icon: string
  │     ├── isDefault: boolean
  │     └── createdAt: timestamp
  │
  ├── receivables/{receivableId}
  │     ├── clientName: string
  │     ├── clientPhone: string
  │     ├── amount: number
  │     ├── status: "pendiente" | "pagado" | "vencido"
  │     ├── dueDate: timestamp
  │     └── createdAt: timestamp
  │
  └── usage/{monthId}
        ├── aiRegistrationsUsed: number
        ├── aiRegistrationsLimit: number | null
        └── updatedAt: timestamp
```

## Reglas de negocio clave

- Todo usuario nuevo se crea con `plan: "emprendedor"` (gratuito).
- Cada `amount` en `transactions` debe ser positivo; el signo lo da `type`.
- `categories` se siembra automáticamente al crear el usuario.
- La Cloud Function `parseTransactionText` (Fase 3) controla el límite de
  registros IA/mes leyendo y actualizando `usage/{monthId}` de forma
  transaccional, evitando condiciones de carrera.

## Índices compuestos sugeridos

- `transactions`: `date DESC` + `type ASC`
- `transactions`: `category ASC` + `date DESC`
