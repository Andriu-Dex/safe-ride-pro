## 1. Tipos de pruebas
### Backend API

- `test/unit/...`
  - pruebas unitarias de casos de uso, servicios y helpers
- `test/integration/...`
  - pruebas de integracion HTTP de controladores, DTOs, guards y respuestas
- `test/db/...`
  - pruebas con base de datos real

### Frontend Web

- `src/**/*.spec.ts`
- `src/**/*.spec.tsx`
  - pruebas de componentes, helpers y estados visuales

### E2E

- `apps/web/e2e/specs/...`
  - flujos completos en navegador real con Playwright

## 2. Como ver reportes de coverage

### Coverage del backend

```powershell
corepack pnpm --filter @saferidepro/api test:coverage
```

Esto genera cobertura de:

- statements
- branches
- functions
- lines

Normalmente Jest deja el reporte en:

```text
apps/api/coverage/
```

El archivo principal para abrir en navegador suele ser:

```text
apps/api/coverage/lcov-report/index.html
```

### Coverage del frontend

```powershell
corepack pnpm --filter @saferidepro/web test:coverage
```

Esto genera la cobertura de los componentes y funciones del frontend utilizando Vitest y `@vitest/coverage-v8`.
Los reportes se generan en formatos text, html y lcov.

Para ver el reporte completo en tu navegador, abre el siguiente archivo:

```text
apps/web/coverage/index.html
```

## 3. Como ver reportes de Playwright

### Todas las pruebas E2E (Completas)

```powershell
corepack pnpm --filter @saferidepro/web test:e2e
```

### Smoke E2E local

```powershell
corepack pnpm --filter @saferidepro/web test:e2e:smoke:local
```

### Modo visual interactivo

```powershell
corepack pnpm --filter @saferidepro/web test:e2e:ui:local
```

### Abrir reporte HTML

```powershell
corepack pnpm --filter @saferidepro/web exec playwright show-report
```

Ese reporte permite mostrar:

- pasos
- tiempos
- capturas
- videos
- errores
- traces

## 4. Comandos por modulo

### Modulo `auth`

#### Unitario backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/unit/auth
```

#### Integracion backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/integration/auth
```

#### Real DB

```powershell
corepack pnpm --filter @saferidepro/api test:db -- auth
```

#### Frontend

```powershell
corepack pnpm --filter @saferidepro/web exec vitest run src/modules/auth/components/login-form.spec.tsx src/modules/auth/components/register-form.spec.tsx src/modules/auth/components/forgot-password-form.spec.tsx src/modules/auth/components/reset-password-form.spec.tsx src/modules/auth/components/auth-provider.spec.tsx src/modules/auth/lib/auth-storage.spec.ts src/modules/auth/lib/operational-context.spec.ts
```

#### E2E relacionado

```powershell
corepack pnpm --filter @saferidepro/web exec playwright test e2e/specs/auth-admin.spec.ts
```

---

### Modulo `trips`

#### Unitario backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/unit/trips
```

#### Integracion backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/integration/trips
```

#### Real DB relacionado

```powershell
corepack pnpm --filter @saferidepro/api test:db -- mvp
```

#### Frontend

```powershell
corepack pnpm --filter @saferidepro/web exec vitest run src/modules/trips/components/trip-filters-panel.spec.tsx src/modules/trips/components/trip-delete-confirmation-modal.spec.tsx src/modules/trips/components/trip-request-cancel-confirmation-modal.spec.tsx src/modules/trips/lib/geoapify.spec.ts src/modules/trips/lib/trip-live-tracking-metrics.spec.ts
```

#### E2E relacionado

```powershell
corepack pnpm --filter @saferidepro/web exec playwright test e2e/specs/driver-onboarding-trip.spec.ts
```

---

### Modulo `trip-requests`

#### Unitario backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/unit/trip-requests
```

#### Integracion backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/integration/trip-requests
```

#### E2E relacionado

```powershell
corepack pnpm --filter @saferidepro/web exec playwright test e2e/specs/passenger-trust-audit.spec.ts
```

---

### Modulo `reports`

#### Unitario backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/unit/reports
```

#### Integracion backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/integration/reports
```

#### Frontend

```powershell
corepack pnpm --filter @saferidepro/web exec vitest run src/modules/reports/components/report-opportunity-card.spec.tsx src/modules/reports/lib/report-labels.spec.ts
```

---

### Modulo `ratings`

#### Unitario backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/unit/ratings
```

#### Integracion backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/integration/ratings
```

#### Frontend

```powershell
corepack pnpm --filter @saferidepro/web exec vitest run src/modules/ratings/components/rating-opportunity-card.spec.tsx src/modules/ratings/lib/rating-labels.spec.ts
```

---

### Modulo `vehicles`

#### Unitario backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/unit/vehicles
```

#### Integracion backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/integration/vehicles
```

#### Frontend

```powershell
corepack pnpm --filter @saferidepro/web exec vitest run src/modules/vehicles/lib/vehicle-labels.spec.ts
```

---

### Modulo `drivers`

#### Unitario backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/unit/drivers
```

#### Integracion backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/integration/drivers
```

#### Frontend relacionado

```powershell
corepack pnpm --filter @saferidepro/web exec vitest run src/modules/driver/lib/driver-status.spec.ts
```

#### E2E relacionado

```powershell
corepack pnpm --filter @saferidepro/web exec playwright test e2e/specs/driver-onboarding-trip.spec.ts
```

---

### Modulo `wallet`

#### Unitario backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/unit/wallet
```

#### Integracion backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/integration/wallet
```

#### Frontend

```powershell
corepack pnpm --filter @saferidepro/web exec vitest run src/modules/wallet/lib/wallet-labels.spec.ts
```

---

### Modulo `payments`

#### Unitario backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/unit/payments
```

#### Integracion backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/integration/payments
```

#### Frontend

```powershell
corepack pnpm --filter @saferidepro/web exec vitest run src/modules/payments/lib/payment-labels.spec.ts
```

---

### Modulo `users`

#### Unitario backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/unit/users
```

#### Integracion backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/integration/users
```

#### Real DB relacionado

```powershell
corepack pnpm --filter @saferidepro/api test:db -- users
```

#### Frontend

```powershell
corepack pnpm --filter @saferidepro/web exec vitest run src/modules/users/components/profile-onboarding-form.spec.tsx src/components/layout/protected-route.spec.tsx
```

---

### Modulo `institutions`

#### Unitario backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/unit/institutions
```

#### Integracion backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/integration/institutions
```

#### Real DB

```powershell
corepack pnpm --filter @saferidepro/api test:db -- institutions
```

---

### Modulo `sanctions`

#### Unitario backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/unit/sanctions
```

#### Integracion backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/integration/sanctions
```

#### Real DB

```powershell
corepack pnpm --filter @saferidepro/api test:db -- sanctions
```

#### Frontend relacionado

```powershell
corepack pnpm --filter @saferidepro/web exec vitest run src/modules/sanctions/lib/sanction-api.spec.ts
```

---

### Modulo `audit`

#### Unitario backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/unit/audit
```

#### Integracion backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/integration/audit
```

#### Frontend relacionado

```powershell
corepack pnpm --filter @saferidepro/web exec vitest run src/modules/audit/lib/audit-access.spec.ts
```

---

### Modulo `notifications`

#### Unitario backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/unit/notifications
```

#### Integracion backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/integration/notifications
```

---

### Modulo `health`

#### Unitario backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/unit/health
```

#### Integracion backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/integration/health
```

---

### Modulo `realtime`

#### Integracion backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/integration/realtime
```

---

### Modulo `confianza` en frontend

```powershell
corepack pnpm --filter @saferidepro/web exec vitest run src/app/(app)/confianza/components/pending-actions.spec.tsx src/app/(app)/confianza/components/activity-history.spec.tsx src/app/(app)/confianza/utils/trust-helpers.spec.ts
```

## 6. Como ejecutar toda la bateria por capas

### Todo backend

```powershell
corepack pnpm --filter @saferidepro/api test
```

### Todo backend con DB real

```powershell
corepack pnpm --filter @saferidepro/api test:db
```

### Todo frontend unitario

```powershell
corepack pnpm --filter @saferidepro/web test
```

### Todo E2E smoke local

```powershell
corepack pnpm --filter @saferidepro/web test:e2e:smoke:local
```

### Verificacion amplia del proyecto

```powershell
corepack pnpm qa:test:api:web
```