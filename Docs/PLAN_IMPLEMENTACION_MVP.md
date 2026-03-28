# PLAN_IMPLEMENTACION_MVP

---

## 1. Estado actual del MVP

### Completado

- documentación base del producto
- arquitectura clean modular
- multiinstitución con base de datos compartida
- autenticación, registro, verificación y perfil de usuario
- instituciones y dominios institucionales
- solicitud y revisión de conductor
- registro y catálogo de vehículos

### Pendiente del MVP

El orden oficial restante de implementación es:

1. `trips`
2. `trip-requests`
3. `ratings`
4. `reports`
5. `audit`
6. integración web del MVP
7. endurecimiento técnico final

---

## 2. Fase siguiente obligatoria: Trips

La siguiente fase oficial del proyecto es la implementación de `trips`.

### Decisiones cerradas

- cada viaje pertenece a una institución
- cada viaje pertenece a una membresía de conductor
- cada viaje usa un solo vehículo
- solo un conductor `APPROVED` puede publicar viajes
- el viaje guarda coordenadas exactas
- el listado público muestra solo zona aproximada
- el viaje debe almacenar una instantánea operativa mínima para no depender de cambios futuros del vehículo

### Entidad `Trip`

La entidad `Trip` debe incluir al menos:

- `institutionId`
- `driverMembershipId`
- `vehicleId`
- `status`
- `routeMode`
- `originLabel`
- `destinationLabel`
- `originLatitude`
- `originLongitude`
- `destinationLatitude`
- `destinationLongitude`
- `departureAt`
- `seatCount`
- `availableSeats`
- `basePriceReference`
- `detourSurchargeReference`
- `luggagePolicySnapshot`
- `notes`
- `createdAt`
- `updatedAt`

### Estados cerrados de viaje

- `DRAFT`
- `PUBLISHED`
- `FULL`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`

### Modos cerrados de viaje

- `DIRECT_ROUTE`
- `PLANNED_DETOUR`

### Endpoints cerrados

- `POST /api/trips`
- `GET /api/trips`
- `GET /api/trips/:id`
- `PATCH /api/trips/:id/publish`
- `PATCH /api/trips/:id/start`
- `PATCH /api/trips/:id/complete`
- `PATCH /api/trips/:id/cancel`

### Reglas cerradas

- no permitir publicar viajes con vehículo inactivo
- no permitir publicar viajes con conductor no aprobado
- no permitir viajes con `availableSeats > seatCount`
- no permitir dos viajes activos o solapados para el mismo conductor
- no permitir editar campos críticos después de iniciar el viaje
- el viaje cancelado no puede volver a publicarse

---

## 3. Fase siguiente inmediata después: Trip Requests

La fase inmediatamente posterior a `trips` será `trip-requests`.

### Decisiones cerradas

- una solicitud pertenece a un viaje y a una membresía de pasajero
- el pasajero no puede solicitar su propio viaje
- no puede haber dos solicitudes activas del mismo pasajero al mismo viaje
- en `PLANNED_DETOUR` la solicitud puede incluir punto requerido
- al aceptar una solicitud se descuenta cupo
- al cancelar o rechazar se libera cupo cuando corresponda

### Entidad `TripRequest`

La entidad `TripRequest` debe incluir al menos:

- `tripId`
- `passengerMembershipId`
- `status`
- `requestedPickupLatitude`
- `requestedPickupLongitude`
- `requestedDropoffLatitude`
- `requestedDropoffLongitude`
- `requestMessage`
- `reviewNote`
- `createdAt`
- `reviewedAt`
- `cancelledAt`

### Estados cerrados de solicitud

- `PENDING`
- `ACCEPTED`
- `REJECTED`
- `CANCELLED`

### Endpoints cerrados

- `POST /api/trip-requests`
- `GET /api/trip-requests/me`
- `PATCH /api/trip-requests/:id/accept`
- `PATCH /api/trip-requests/:id/reject`
- `PATCH /api/trip-requests/:id/cancel`

---

## 4. Cierre funcional del MVP

Las fases siguientes, en este orden, serán:

- `ratings`
- `reports`
- `audit`
- web MVP

### Decisiones cerradas para `ratings`

- solo se puede calificar tras un viaje `COMPLETED`
- pasajero califica conductor
- conductor califica pasajero
- una sola calificación por relación y viaje
- escala inicial simple de 1 a 5
- comentario opcional

### Endpoints de `ratings`

- `POST /api/ratings`
- `GET /api/ratings/me`

### Decisiones cerradas para `reports`

- solo usuarios participantes del viaje pueden reportar
- el reporte se relaciona con viaje y usuario reportado
- evidencia opcional por ahora como `fileKey`
- revisión administrativa posterior

### Estados cerrados para `reports`

- `PENDING`
- `UNDER_REVIEW`
- `RESOLVED`
- `DISMISSED`

### Endpoints de `reports`

- `POST /api/reports`
- `GET /api/reports/me`
- `PATCH /api/reports/:id/review`

### Decisiones cerradas para `audit`

- no tendrá endpoints públicos para usuarios normales
- debe registrar autenticación sensible, revisión de conductores, decisiones administrativas y cambios críticos de viajes

### Decisiones cerradas para web MVP

- primero consumir `auth`, `drivers`, `vehicles`, `trips` y `trip-requests`
- no construir todavía mobile real ni pagos
- todo texto visible al usuario debe estar en español
- el código permanece en inglés

---

## 5. Criterio de cierre por fase

Cada fase debe considerarse terminada solo si cumple esta definición de hecho:

- esquema Prisma actualizado
- migración creada y aplicada
- seed actualizado si aplica
- módulo Nest completo en capas `application`, `infrastructure`, `presentation`
- DTOs y validaciones
- reglas de negocio críticas cubiertas
- `typecheck` exitoso
- `build` exitoso
- endpoints probados manualmente o con tests

---

## 6. Interfaces y tipos públicos que deben añadirse

Las siguientes ampliaciones de interfaz son obligatorias en fases futuras:

- enums compartidos para `TripStatus`, `TripRouteMode`, `TripRequestStatus`, `ReportStatus`
- DTOs de creación y transición de estado para viajes y solicitudes
- respuestas del API consistentes con mensajes en español
- filtros de listado para viajes por origen, destino, fecha, modalidad y tipo de vehículo

### No se implementará todavía

- pagos
- tracking en vivo obligatorio
- push notifications
- interoperabilidad entre instituciones
- mobile productivo

---

## 7. Plan de pruebas

Este es el conjunto mínimo de escenarios que debe cubrir la implementación del MVP:

- registro de conductor con licencia válida y vencida
- revisión de conductor aprobada y rechazada
- registro de vehículo con cupos válidos e inválidos
- creación de viaje por conductor aprobado y bloqueo para conductor no aprobado
- publicación de viaje y transición correcta entre estados
- solicitud de cupo válida, duplicada y a viaje propio
- aceptación y rechazo con ajuste correcto de cupos
- cancelación de solicitud con liberación de cupo
- calificación solo después de `COMPLETED`
- reporte solo por participantes del viaje
- aislamiento institucional correcto en listados y acciones

---

## 8. Supuestos y decisiones por defecto
- el documento es temporal y por eso no se numera
- el plan debe mostrar módulos ya completados y módulos pendientes
- no debe incluir fechas calendario ni estimaciones por horas
- debe escribirse en español
- debe alinearse con `Docs/REQUERIMIENTOS.md`, `Docs/02_PROTOCOLO_FUNCIONAL_V2.md`, `Docs/03_ESTRUCTURA_CLEAN_ARCHITECTURE.md`, `Docs/04_POLITICAS_Y_REGLAS_OPERATIVAS.md` y `Docs/05_MODELO_MULTIINSTITUCIONAL.md`