# SafeRidePro - Estructura Clean Architecture
---

## 1. Objetivo

Definir una estructura tecnica que permita desarrollar SafeRidePro con bajo acoplamiento, alta cohesión, facilidad de prueba y crecimiento controlado, evitando sobreingenieria.

La propuesta para este proyecto es usar una **Clean Architecture ligera por modulos**, adaptada a NestJS y al enfoque de monorepo.

---

## 2. Principios base

- El dominio no debe depender de frameworks.
- La logica de negocio debe vivir fuera de controllers, ORM y servicios externos.
- La infraestructura debe implementar contratos definidos por la aplicacion o el dominio.
- Cada modulo debe ser independiente en la medida de lo posible.
- Las dependencias siempre deben apuntar hacia adentro.
- El codigo debe organizarse por feature y no solo por tipo de archivo.

---

## 3. Capas de la arquitectura

### 3.1 Domain

Contiene las reglas de negocio puras.

Elementos recomendados:

- entidades
- value objects
- enums de dominio
- reglas de negocio puras
- errores de dominio
- interfaces de repositorio si pertenecen al nucleo del negocio

Ejemplos para U-Ride:

- `Trip`
- `TripMode`
- `User`
- `Rating`
- `Report`
- `DetourPolicy`

### 3.2 Application

Contiene los casos de uso del sistema.

Elementos recomendados:

- use cases
- comandos y queries
- DTOs internos de aplicacion
- puertos de entrada y salida
- validaciones de reglas de aplicacion
- coordinacion transaccional

Ejemplos para U-Ride:

- `CreateTripUseCase`
- `RequestTripSeatUseCase`
- `AcceptTripRequestUseCase`
- `CompleteTripUseCase`
- `RateTripParticipantUseCase`

### 3.3 Infrastructure

Contiene implementaciones tecnicas concretas.

Elementos recomendados:

- repositorios Prisma
- adaptadores de correo
- adaptadores de mapas
- adaptadores de almacenamiento de archivos
- gateways externos
- configuracion de base de datos
- implementacion de cache

Ejemplos para U-Ride:

- `PrismaTripRepository`
- `ResendEmailService`
- `GoogleMapsRouteService`
- `S3FileStorageService`

### 3.4 Presentation

Contiene la capa de entrada al sistema.

Elementos recomendados:

- controllers REST
- DTOs HTTP
- serializers
- guards
- pipes
- middlewares
- gateways WebSocket si luego se usan

Ejemplos para U-Ride:

- `TripsController`
- `AuthController`
- `ReportsController`

---

## 4. Regla de dependencias

La direccion correcta de dependencias es:

`presentation -> application -> domain`

`infrastructure -> application -> domain`

El `domain` no conoce `NestJS`, `Prisma`, `HTTP`, `Redis`, `Google Maps` ni ninguna tecnologia externa.

---

## 5. Estructura recomendada del monorepo

```text
apps/
  api/
  web/
  mobile/
packages/
  shared-types/
  eslint-config/
  tsconfig/
Doc/
```

---

## 6. Estructura recomendada del backend

```text
apps/
  api/
    src/
      modules/
        auth/
          domain/
          application/
          infrastructure/
          presentation/
          auth.module.ts
        users/
          domain/
          application/
          infrastructure/
          presentation/
          users.module.ts
        trips/
          domain/
          application/
          infrastructure/
          presentation/
          trips.module.ts
        trip-requests/
          domain/
          application/
          infrastructure/
          presentation/
          trip-requests.module.ts
        ratings/
          domain/
          application/
          infrastructure/
          presentation/
          ratings.module.ts
        reports/
          domain/
          application/
          infrastructure/
          presentation/
          reports.module.ts
        audit/
          domain/
          application/
          infrastructure/
          presentation/
          audit.module.ts
      shared/
        domain/
        application/
        infrastructure/
        presentation/
      config/
      prisma/
      main.ts
      app.module.ts
```

---

## 7. Responsabilidad por modulo

### 7.1 Auth

Responsable de:

- registro
- login
- refresh token
- verificacion por correo institucional
- recuperacion de acceso

### 7.2 Users

Responsable de:

- perfil de usuario
- datos personales
- configuracion basica
- rol operativo de conductor

### 7.3 Trips

Responsable de:

- publicacion de viajes
- calculo base del viaje
- origen y destino
- modo del viaje
- estados del viaje

### 7.4 Trip Requests

Responsable de:

- solicitudes de cupo
- aceptacion o rechazo
- confirmacion de participacion
- control de cupos

### 7.5 Ratings

Responsable de:

- calificaciones
- reseñas
- reputacion agregada

### 7.6 Reports

Responsable de:

- reportes de conducta
- evidencias
- resolucion administrativa

### 7.7 Audit

Responsable de:

- trazabilidad
- registro de eventos
- auditoria de acciones importantes

---

## 8. Ejemplo interno de un modulo

Ejemplo sugerido para `trips`:

```text
trips/
  domain/
    entities/
      trip.entity.ts
    enums/
      trip-mode.enum.ts
      trip-status.enum.ts
    errors/
      trip-capacity-exceeded.error.ts
      invalid-detour-distance.error.ts
    services/
      trip-price-calculator.service.ts
    repositories/
      trip.repository.ts
  application/
    dto/
      create-trip.input.ts
      trip.output.ts
    use-cases/
      create-trip.use-case.ts
      publish-trip.use-case.ts
      complete-trip.use-case.ts
    ports/
      route-service.port.ts
      event-bus.port.ts
  infrastructure/
    persistence/
      prisma-trip.repository.ts
    services/
      google-maps-route.service.ts
    mappers/
      trip-prisma.mapper.ts
  presentation/
    dto/
      create-trip.request.dto.ts
      trip.response.dto.ts
    controllers/
      trips.controller.ts
```

---

## 9. Flujo de una peticion

Ejemplo: crear un viaje

1. `TripsController` recibe la peticion HTTP.
2. Convierte el request al input del caso de uso.
3. `CreateTripUseCase` valida reglas de aplicacion.
4. Se crea o actualiza la entidad de dominio correspondiente.
5. El caso de uso usa una interfaz de repositorio.
6. La implementacion real vive en infraestructura, por ejemplo Prisma.
7. El resultado vuelve a presentacion y se responde al cliente.

---

## 10. Donde poner cada cosa

### Va en Domain

- reglas puras del precio con desvio
- validacion de capacidad del viaje
- estados y transiciones validas del viaje
- restricciones del negocio

### Va en Application

- crear viaje
- aceptar solicitud
- finalizar viaje
- registrar calificacion
- resolver reporte

### Va en Infrastructure

- Prisma
- Resend
- Google Maps
- Redis
- S3

### Va en Presentation

- endpoints REST
- validacion de requests
- autenticacion HTTP
- documentacion Swagger

---

## 11. Shared vs modulo propio

Solo debe ir a `shared` lo que sea verdaderamente comun entre varios modulos.

Ejemplos validos:

- errores base
- tipos comunes
- utilidades transversales
- clases base de paginacion
- contratos tecnicos reutilizables

No conviene poner en `shared` logica de negocio especifica de viajes, usuarios o reportes.

---

## 12. Arquitectura recomendada para el frontend

Aunque el frontend no necesita copiar exactamente la misma estructura del backend, conviene mantener organizacion por modulos.

Ejemplo:

```text
apps/
  web/
    src/
      modules/
        auth/
        profile/
        trips/
        reports/
      components/
      lib/
      hooks/
      app/
```

La idea es que `trips`, `auth` y `reports` tambien tengan separacion por feature y no mezclar todo en carpetas genericas.

---

## 13. Decision recomendada para U-Ride

Para este proyecto, la mejor opcion es:

- `Clean Architecture ligera`
- `organizacion por modulos`
- `NestJS como framework contenedor`
- `Prisma solo en infraestructura`
- `casos de uso explicitos en application`

No recomiendo:

- Onion Architecture estricta en una primera version
- una arquitectura demasiado generica con demasiadas abstracciones
- poner toda la logica en services de NestJS sin separacion de capas
- mezclar controllers con consultas Prisma directas

---

## 14. Beneficios esperados

- codigo mas facil de entender
- mejor testabilidad
- menor acoplamiento con herramientas externas
- crecimiento ordenado por modulos
- menor riesgo de spaghetti code

---

## 15. Reglas practicas para mantener esta arquitectura

- Un controller no debe contener logica de negocio.
- Un caso de uso no debe conocer detalles de HTTP.
- Una entidad de dominio no debe importar Prisma.
- Un repositorio de infraestructura no debe decidir reglas del negocio.
- Un modulo no debe depender internamente de otro modulo sin una interfaz clara.
- Si una abstraccion no aporta claridad, no se crea.

---

## 16. Pendientes para la implementacion

- definir nombres finales de modulos
- definir si algunos modulos se fusionan en MVP
- definir estrategia de eventos y auditoria
- definir estructura exacta de `shared-types`
- definir convenciones de nombres para DTOs, entities y use cases
