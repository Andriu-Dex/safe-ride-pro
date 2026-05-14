# 07_ENTORNO_QA_DEPLOY

## Objetivo

Este documento deja definido el entorno `QA local final` de `SafeRidePro` usando herramientas gratuitas y reproducibles.

El objetivo no es reemplazar un despliegue productivo administrado, sino contar con una forma estable de:

- levantar el sistema completo fuera del entorno local manual
- validar el MVP con una configuracion cercana a produccion
- facilitar demostraciones academicas y revisiones

## Componentes del entorno

El entorno de `QA` inicial queda compuesto por:

- `PostgreSQL` en contenedor
- `API` NestJS en contenedor
- `Web` Next.js en contenedor

Archivos principales:

- `docker-compose.qa.yml`
- `deploy/api.Dockerfile`
- `deploy/web.Dockerfile`
- `.env.qa.example`

## Preparacion

Antes de levantar este entorno debes tener `Docker Desktop` o el daemon de Docker corriendo.

1. Crear un archivo `.env.qa` en la raiz del proyecto tomando como base `.env.qa.example`
2. Ajustar valores si hace falta
3. Ejecutar el entorno con Docker Compose

Comando:

```powershell
Copy-Item .env.qa.example .env.qa
docker compose --env-file .env.qa -f docker-compose.qa.yml up --build
```

Tambien puedes usar los scripts del proyecto:

```powershell
corepack pnpm qa:up:build
corepack pnpm qa:ps
corepack pnpm qa:logs
corepack pnpm qa:down
```

## Puertos esperados

- web: `http://localhost:3000`
- api: `http://localhost:3001`
- postgres: `localhost:5432`

Healthchecks:

- web: `http://localhost:3000/healthz`
- api: `http://localhost:3001/api/health`

## Comportamiento esperado

Al iniciar el contenedor de `api`, el entorno:

- aplica migraciones con `migrate deploy`
- ejecuta el seed inicial
- levanta el backend

El archivo `docker-compose.qa.yml` ahora incluye `healthchecks` para:

- `postgres`
- `api`
- `web`

Esto permite que `web` espere a que `api` este realmente lista antes de iniciar.

Esto permite tener el entorno listo para pruebas sin pasos manuales extra. Si el stack ya esta saludable, los smoke E2E reutilizan los contenedores existentes; si necesitas forzar reconstruccion, ejecuta:

```powershell
$env:PLAYWRIGHT_FORCE_QA_REBUILD="true"
corepack pnpm --filter @saferidepro/web test:e2e:smoke
```

## Credenciales iniciales

Si usas los valores del archivo de ejemplo:

- admin: `admin@uta.edu.ec` / `Admin12345`
- pasajero: `pasajero@uta.edu.ec` / `Passenger123!`
- conductor aprobado: `conductor@uta.edu.ec` / `Driver123!`
- conductor pendiente: `conductor-pendiente@uta.edu.ec` / `Driver123!`

## Flujo QA recomendado

Desde la raiz del proyecto:

```powershell
corepack pnpm qa:up:build
corepack pnpm qa:ps
corepack pnpm qa:verify:web
corepack pnpm qa:release:web
```

Para apagar sin borrar datos:

```powershell
corepack pnpm qa:down
```

Para reiniciar el entorno desde cero con volumen limpio:

```powershell
corepack pnpm qa:reset
corepack pnpm qa:up:build
```

## Alcance de esta fase

Este entorno esta pensado para:

- QA local
- demostraciones
- validacion academica
- pruebas funcionales del MVP

No reemplaza una estrategia final de produccion con dominios, TLS, backups, observabilidad y gestion de secretos.

## Buenas practicas incluidas

En esta version del entorno QA se deja aplicado lo siguiente:

- ejecucion de contenedores de aplicacion con usuario no root
- healthchecks de servicios
- scripts reproducibles desde la raiz del proyecto
- semilla inicial automatica para entorno de prueba
