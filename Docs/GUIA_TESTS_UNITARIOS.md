# Guia de pruebas unitarias

## 1. Stack real de pruebas usado en este proyecto

- `API backend`
  - `Jest`
  - `ts-jest`
  - `Nest TestingModule` en los casos que lo requieren
- `Web frontend`
  - `Vitest`
  - `React Testing Library`
  - `jsdom`

## 2. Requisitos previos

Abrir una terminal en la raiz del proyecto:

```powershell
cd C:\Users\andri\Documentos\D-Proyectos\Git\SafeRidePro
```

Tener instalado:

- `Node.js`
- `pnpm` via `corepack`

Si es la primera vez:

```powershell
corepack enable
corepack pnpm install
```

## 3. Como ejecutar todos los unitarios del backend

```powershell
corepack pnpm --filter @saferidepro/api test
```

Esto ejecuta:

- unitarios
- integracion HTTP

Si solo se quiere validar tipado:

```powershell
corepack pnpm --filter @saferidepro/api typecheck
```

## 4. Como ejecutar solo unitarios del frontend

```powershell
corepack pnpm --filter @saferidepro/web test
```

Si quieres modo interactivo:

```powershell
corepack pnpm --filter @saferidepro/web test:watch
```

## 5. Como ejecutar pruebas unitarias puntuales por archivo

### Backend API

Ejemplo con autenticacion:

```powershell
corepack pnpm --filter @saferidepro/api test -- test/unit/auth/login.use-case.spec.ts
```

Ejemplo con viajes:

```powershell
corepack pnpm --filter @saferidepro/api test -- test/unit/trips/create-trip.use-case.spec.ts
```

Ejemplo con billetera:

```powershell
corepack pnpm --filter @saferidepro/api test -- test/unit/wallet/wallet.service.spec.ts
```

### Frontend Web

Ejemplo con login:

```powershell
corepack pnpm --filter @saferidepro/web exec vitest run src/modules/auth/components/login-form.spec.tsx
```

Ejemplo con viajes:

```powershell
corepack pnpm --filter @saferidepro/web exec vitest run src/modules/trips/components/trip-filters-panel.spec.tsx
```

Ejemplo con confianza:

```powershell
corepack pnpm --filter @saferidepro/web exec vitest run src/app/(app)/confianza/components/pending-actions.spec.tsx
```

## 6. Como ejecutar varios unitarios relacionados

### Prioridad de autenticacion y perfil

Backend:

```powershell
corepack pnpm --filter @saferidepro/api test:priority:auth-profile
```

Frontend:

```powershell
corepack pnpm --filter @saferidepro/web test:priority:auth-profile
```

### Auth completo en backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/unit/auth
```

### Viajes completo en backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/unit/trips
```

### Solicitudes de viaje en backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/unit/trip-requests
```

### Reportes y calificaciones en backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/unit/reports test/unit/ratings
```

### Vehiculos y conductor en backend

```powershell
corepack pnpm --filter @saferidepro/api test -- test/unit/vehicles test/unit/drivers
```

## 7. Como saber si una prueba paso o fallo

Cuando pasa, la terminal muestra algo como:

```text
PASS test/unit/trips/create-trip.use-case.spec.ts
```

Al final veras un resumen:

```text
Test Suites: 89 passed, 89 total
Tests:       377 passed, 377 total
```

Si falla, veras:

- el archivo que fallo
- la linea exacta
- el mensaje del error
- el `expected` y el `received`

## 8. Recomendacion practica para demostracion

Si la exposicion es corta, el orden mas eficiente es:

1. `auth` backend
2. `auth` frontend
3. `trips` backend
4. `trip-requests` backend
5. `reports` y `ratings`
6. luego cerrar con `Playwright`

## 9. Comandos rapidos mas utiles

```powershell
# Todo backend
corepack pnpm --filter @saferidepro/api test

# Todo frontend
corepack pnpm --filter @saferidepro/web test

# Solo auth backend
corepack pnpm --filter @saferidepro/api test -- test/unit/auth

# Solo viajes backend
corepack pnpm --filter @saferidepro/api test -- test/unit/trips

# Solo solicitudes backend
corepack pnpm --filter @saferidepro/api test -- test/unit/trip-requests

# Solo auth frontend
corepack pnpm --filter @saferidepro/web exec vitest run src/modules/auth/components/login-form.spec.tsx src/modules/auth/components/register-form.spec.tsx src/modules/auth/components/forgot-password-form.spec.tsx src/modules/auth/components/reset-password-form.spec.tsx
```
