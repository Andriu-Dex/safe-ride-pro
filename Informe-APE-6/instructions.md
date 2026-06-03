# Guía operativa APE 6

## Alcance implantado
La implantación funcional presentada para SafeRidePro quedó distribuida de esta manera:

- **Local:** Docker Compose
- **Nube:** Render + Supabase
- **Fuera de alcance operativo:** `apps/mobile`

## Implantación local

### Componentes utilizados
- `docker-compose.qa.yml`
- `deploy/api.Dockerfile`
- `deploy/web.Dockerfile`
- `.env.qa`

### Secuencia ejecutada
1. Preparar el archivo `.env.qa`.
2. Levantar el stack:
   ```powershell
   corepack pnpm qa:up:build
   ```
3. Verificar contenedores:
   ```powershell
   corepack pnpm qa:ps
   ```
4. Validar:
   - `http://localhost:3000`
   - `http://localhost:3001/api/health`
   - `http://localhost:3000/healthz`
5. Iniciar sesión con una cuenta seed.

### Persistencia local
La recuperación automática tras reinicio quedó soportada por:
- `restart: unless-stopped` en los servicios de Docker Compose
- arranque automático de Docker Desktop con Windows

## Implantación en la nube

## Supabase

### Proyecto de base de datos
Se creó el proyecto `saferidepro` en Supabase y se utilizó la cadena PostgreSQL obtenida desde:
- `Connect`
- método `Session pooler`

Ese valor fue asignado a:
- `DATABASE_URL`

## Render

### Servicios desplegados
Se publicaron dos servicios web:

- `saferidepro-api`
- `saferidepro-web`

### Configuración del backend

#### Build Command
```bash
corepack prepare pnpm@latest --activate && pnpm install --frozen-lockfile && pnpm --filter @saferidepro/shared-types build && pnpm --filter @saferidepro/api prisma:generate && pnpm --filter @saferidepro/api build
```

#### Start Command
```bash
pnpm --filter @saferidepro/api db:deploy && pnpm --filter @saferidepro/api db:seed && node apps/api/dist/main.js
```

#### Health Check
```txt
/api/health
```

#### Variables principales
- `DATABASE_URL`
- `JWT_SECRET`
- `WEB_APP_ORIGINS`
- `API_PUBLIC_BASE_URL`
- `AUTH_ALLOW_DEBUG_CODES`
- `PAYMENTS_CURRENCY`
- `PAYPAL_ENABLED`

### Configuración del frontend

#### Build Command
```bash
corepack prepare pnpm@latest --activate && pnpm install --frozen-lockfile && pnpm --filter @saferidepro/shared-types build && pnpm --filter @saferidepro/web build
```

#### Start Command
```bash
node scripts/run-web-next.js start --hostname 0.0.0.0 --port $PORT
```

#### Health Check
```txt
/healthz
```

#### Variables principales
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_GEOAPIFY_API_KEY`

## Validación pública realizada
- `https://saferidepro-api.onrender.com/api/health`
- `https://saferidepro-web.onrender.com/healthz`
- `https://saferidepro-web.onrender.com/login`
- navegación autenticada a módulos del sistema

## Build filters en Render
No fue necesario configurarlos para que el despliegue funcionara.

Su función es únicamente optimizar cuándo Render debe volver a construir un servicio después de cambios en el repositorio. Si ya tienes el sistema publicado y estable, no necesitas hacer nada adicional con ese apartado para cerrar este deber.

## Limitaciones observadas en la capa gratuita

### Render
- la instancia entra en suspensión por inactividad
- la primera respuesta después de ese periodo puede tardar
- no hay disco persistente en free web services
- no hay acceso SSH al servicio web gratuito

### Supabase
- la capacidad del proyecto gratuito es limitada
- el proyecto puede pausarse tras periodos prolongados sin uso

## Evidencia colocada en `Imagenes`
Se normalizaron referencias para el informe con:

- `ape6_local_*`
- `ape6_nube_*`

Además, se conservaron las capturas originales `Render*.png` y `Supabase*.png` como respaldo.
