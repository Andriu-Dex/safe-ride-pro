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

## Puertos esperados

- web: `http://localhost:3000`
- api: `http://localhost:3001`
- postgres: `localhost:5432`

## Comportamiento esperado

Al iniciar el contenedor de `api`, el entorno:

- genera Prisma Client
- aplica migraciones con `db:deploy`
- ejecuta el seed inicial
- levanta el backend

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

## Siguientes mejoras recomendadas

Mas adelante convendra agregar:

- un despliegue gratuito o de bajo costo para demo publica
- variables separadas por ambiente real
- almacenamiento externo para archivos
- observabilidad basica
- smoke tests automatizados sobre el entorno desplegado
