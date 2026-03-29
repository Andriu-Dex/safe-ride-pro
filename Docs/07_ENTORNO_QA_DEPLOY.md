# 07_ENTORNO_QA_DEPLOY

## Objetivo

Este documento deja definido un entorno inicial de `QA/deploy` para `SafeRidePro` usando herramientas gratuitas y reproducibles.

El objetivo no es desplegar todavia a produccion final, sino contar con una forma estable de:

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

- genera Prisma Client
- aplica migraciones con `db:deploy`
- ejecuta el seed inicial
- levanta el backend

El archivo `docker-compose.qa.yml` ahora incluye `healthchecks` para:

- `postgres`
- `api`
- `web`

Esto permite que `web` espere a que `api` este realmente lista antes de iniciar.

Esto permite tener el entorno listo para pruebas sin pasos manuales extra.

## Credenciales iniciales

Si usas los valores del archivo de ejemplo:

- correo: `admin@uta.edu.ec`
- contrasena: `Admin12345`

## Alcance de esta fase

Este entorno esta pensado para:

- QA local
- demostraciones
- validacion academica
- pruebas funcionales del MVP

No reemplaza todavia una estrategia final de produccion.

## Buenas practicas incluidas

En esta version del entorno QA se deja aplicado lo siguiente:

- ejecucion de contenedores de aplicacion con usuario no root
- healthchecks de servicios
- scripts reproducibles desde la raiz del proyecto
- semilla inicial automatica para entorno de prueba
