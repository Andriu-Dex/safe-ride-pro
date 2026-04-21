# 10_HANDOFF_ESTADO_ACTUAL_Y_PENDIENTES

## Objetivo

Este documento deja un traspaso completo del estado actual del proyecto para poder continuar en un nuevo chat sin perder contexto funcional, tecnico ni operativo.

La idea es que este archivo se convierta en la referencia principal de:

- que ya esta implementado
- que decisiones tecnicas ya quedaron tomadas
- que cambio se acaba de desarrollar
- que falta por implementar
- en que orden conviene continuar

---

## 1. Estado general actual

A la fecha, el producto web de `SafeRidePro` ya no esta en fase de MVP basico. La base principal del sistema web ya existe y cubre el flujo central del producto.

El estado real del producto es:

- identidad y acceso web implementados
- onboarding base de usuario implementado
- onboarding de conductor implementado
- gestion de vehiculos implementada
- viajes y solicitudes implementados
- tracking en vivo v1 implementado
- confianza, reportes, sanciones, apelaciones y auditoria implementados
- entorno QA con Docker preparado
- capa de ejecucion operativa del viaje recientemente endurecida

Todavia no es un producto final completamente cerrado para produccion total, pero ya es una aplicacion web funcionalmente amplia y coherente.

---

## 2. Modulos ya implementados

## 2.1 Identidad y acceso

Implementado:

- registro institucional web
- validacion de dominio institucional
- verificacion por codigo
- reenvio de codigo
- login
- logout
- refresh de sesion
- forgot password
- reset password
- auto login despues de verificar correo
- home de bienvenida / dashboard base dentro de la app

Decisiones tecnicas importantes:

- correo real implementado con `SMTP`
- no se uso `Resend` al final por limitaciones practicas del dominio de envio
- el registro no usa `studentCode` manual; el backend lo resuelve internamente

Estado:

- funcional y ya integrado en web y API

---

## 2.2 Perfil e incorporacion institucional

Implementado:

- perfil base editable
- foto de perfil
- telefono opcional
- carrera
- barrio o zona de referencia
- aceptacion de terminos base
- estado de onboarding utilizable desde web
- contexto institucional operativo del usuario actual

Decisiones tecnicas importantes:

- `fullName` se mantiene como campo unico por ahora
- foto de perfil subida externamente y persistida por URL

Estado:

- funcional
- visualmente bastante pulido para web

---

## 2.3 Onboarding de conductor

Implementado:

- envio de solicitud de conductor
- carga de documentos
- almacenamiento y consulta de documentos
- previsualizacion y descarga
- aprobacion y rechazo administrativo
- lectura del estado del conductor desde web

Incidente ya resuelto:

- el selector de archivos fallaba por resincronizacion agresiva de sesion al volver del dialogo del sistema
- la mitigacion aplicada fue suprimir temporalmente la resincronizacion automatica de sesion al abrir selectores de archivos

Estado:

- funcional

---

## 2.4 Vehiculos

Implementado:

- registro de vehiculo
- activacion / desactivacion
- catalogo base de marcas y modelos
- ampliacion del seed inicial del catalogo
- documento de matricula con subida real
- previsualizacion y descarga del documento

Decisiones tecnicas importantes:

- se elimino el input manual de referencia documental
- se priorizo la subida real del documento del vehiculo, igual que en conductor

Estado:

- funcional

---

## 2.5 Viajes, exploracion y solicitudes

Implementado:

- creacion de viajes
- reutilizacion de la ultima ruta usada
- publicacion
- cancelacion
- inicio
- finalizacion
- busqueda y filtros
- explorar viajes
- solicitud de cupo
- aceptacion y rechazo
- cancelacion de solicitud
- cierre automatico de solicitudes pendientes al iniciar viaje
- workspace de conductor
- workspace de pasajero
- workspace de solicitudes
- crear viaje como modulo separado y mas pulido visualmente

Decisiones tecnicas importantes:

- la experiencia de viajes fue reorganizada en workspaces mas claros
- se redujo microcopy redundante para hacer la interfaz mas intuitiva

Estado:

- funcional y visualmente bastante avanzado

---

## 2.6 Geografia y mapas

Implementado:

- busqueda geografica real
- autocomplete
- mapa de origen y destino
- integracion de lugares y seleccion visual

Decision tecnica clave:

- se abandono `Google Maps Platform`
- se migro a `Leaflet + Geoapify`

Motivo:

- no se pudo cerrar correctamente la parte de facturacion de Google Maps
- `Leaflet + Geoapify` resolvio mejor el caso del proyecto en esta etapa

Estado:

- funcional

Limitacion actual:

- el tracking fino estilo Uber todavia no esta completo
- por ahora el sistema trabaja con ruta planificada + estado operativo compartido

---

## 2.7 Tracking en vivo v1

Implementado:

- tracking en vivo base por viaje
- sesion de tracking persistida en base de datos
- historial de posiciones
- emision realtime para conductor y pasajeros autorizados
- panel de seguimiento operativo en web

Estado:

- funcional

Limitacion actual:

- no hay tracking GPS fino con experiencia de ejecucion tipo ridesharing comercial
- no hay socket dedicado de tracking fino por segundo como version avanzada

---

## 2.8 Ejecucion operativa del viaje

Este es el bloque mas reciente implementado.

### Que se agrego

Se bajo a sistema la politica V1 de:

- abordaje
- progreso del trayecto
- cierre operativo del pasajero
- cierre global del viaje con nota excepcional cuando haga falta

### Nuevos estados operativos por solicitud aceptada

Se agrego estado operativo separado del estado de solicitud:

- `ACCEPTED_PENDING_BOARDING`
- `ON_BOARD`
- `DROPPED_OFF`
- `NO_SHOW`
- `CANCELLED_BEFORE_BOARDING`

### Reglas ya implementadas

- solo solicitudes aceptadas entran a ejecucion operativa
- el conductor es la fuente operativa oficial en V1
- el conductor puede marcar:
  - abordo
  - finalizado
  - no-show
- no se puede registrar `no-show` si el pasajero ya fue marcado como `a bordo` o `finalizado`
- si el viaje se quiere cerrar con pasajeros aceptados aun no resueltos, se exige nota de cierre excepcional

### Backend agregado

- migracion Prisma para estados operativos de solicitud
- auditoria de `TRIP_PASSENGER_BOARDED`
- auditoria de `TRIP_PASSENGER_DROPPED_OFF`
- endpoints nuevos:
  - `PATCH /trip-requests/:requestId/boarded`
  - `PATCH /trip-requests/:requestId/dropped-off`
- endurecimiento de `PATCH /trips/:tripId/complete` con `closureNote`

### Frontend agregado

- panel de conductor con acciones por pasajero
- estados visibles de ejecucion
- nota de cierre excepcional
- panel del pasajero con estado operativo propio
- badges y lectura operativa en workspace de solicitudes

### Validacion ejecutada

Se ejecuto y quedo pasando:

- `corepack pnpm --filter @saferidepro/shared-types build`
- `corepack pnpm --filter @saferidepro/api exec prisma migrate dev --name add_trip_request_execution_flow`
- `corepack pnpm --filter @saferidepro/api typecheck`
- `corepack pnpm --filter @saferidepro/api test`
- `corepack pnpm --filter @saferidepro/api build`
- `corepack pnpm --filter @saferidepro/web typecheck`
- `corepack pnpm --filter @saferidepro/web build`

Estado:

- implementado
- validado tecnicamente
- todavia pendiente de pasada manual funcional completa

---

## 2.9 Confianza, reportes, sanciones y apelaciones

Implementado:

- calificaciones post-viaje
- reportes post-viaje
- evidencia de reportes
- severidad de reportes
- sanciones automáticas por reputacion, reincidencia y no-show
- levantamiento manual de sanciones
- apelaciones
- revision administrativa conectada entre reportes, sanciones y apelaciones

Decisiones tecnicas importantes:

- multiples evidencias por caso no se hicieron por ahora
- se dejo como mejora opcional posterior

Estado:

- funcional y bastante integrado

---

## 2.10 Auditoria administrativa

Implementado:

- vista administrativa reservada a administradores
- revision de conductores
- revision de reportes
- sanciones activas
- apelaciones
- previsualizacion y descarga de documentos / evidencias
- resumen de efecto operativo actual por caso

Estado:

- funcional

---

## 2.11 QA / Docker / release readiness parcial

Implementado:

- `docker-compose.qa.yml`
- `deploy/api.Dockerfile`
- `deploy/web.Dockerfile`
- `.env.qa.example`
- scripts QA desde raiz
- healthchecks de servicios
- seed inicial en QA

Ver tambien:

- `Docs/07_ENTORNO_QA_DEPLOY.md`
- `Docs/09_CHECKLIST_QA_WEB_RELEASE.md`

Estado:

- base QA lista
- todavia falta una pasada transversal manual mas disciplinada

---

## 3. Decisiones tecnicas importantes ya cerradas

Estas decisiones no deberian reabrirse sin una razon clara:

- codigo en ingles y textos visibles al usuario en español
- arquitectura limpia / modular
- evitar sobreingenieria
- correo institucional por `SMTP`
- geografia web por `Leaflet + Geoapify`
- tracking actual basado en ruta planificada + estado operativo
- `fullName` como campo unico por ahora
- pagos siguen fuera de alcance por ahora
- mobile sigue fuera del bloque inmediato

---

## 4. Estado del repositorio al cierre de este handoff

Hay cambios relevantes ya implementados y validados tecnicamente que todavia no necesariamente han sido cerrados en commit dentro del flujo actual.

Bloque tecnico abierto en el working tree:

- ejecucion operativa del viaje
- migracion Prisma asociada
- actualizacion de tests y UI asociada

Antes de abrir otro frente funcional, conviene:

1. revisar manualmente el flujo nuevo
2. hacer commit detallado
3. continuar con el siguiente bloque

---

## 5. Lo mas importante que falta por validar manualmente

Del bloque mas reciente conviene probar:

- aceptar solicitud e iniciar viaje
- marcar pasajero como `abordo`
- marcar pasajero como `finalizado`
- intentar registrar `no-show` despues de `abordo` y confirmar que falle
- intentar finalizar viaje con pasajeros aceptados no resueltos
- verificar que pida nota de cierre excepcional
- finalizar con nota y confirmar que cierre
- revisar que el pasajero vea su estado operativo correcto

---

## 6. Que falta por implementar

## 6.1 Pendiente inmediato de producto

Lo mas sano como siguiente bloque no es abrir pagos.

Lo pendiente inmediato mas recomendado es:

- terminar QA manual transversal del flujo web completo
- endurecer detalles finales de ejecucion / post-viaje si aparecen hallazgos
- cerrar commit del bloque actual

## 6.2 Mejoras funcionales razonables para la siguiente etapa

Las mejoras con mejor relacion valor/riesgo son:

- confirmacion post-viaje mas fina entre conductor y pasajero
- endurecimiento final de cierre post-viaje
- mayor claridad entre ejecucion operativa y confianza
- pulido visual final de estados excepcionales

## 6.3 Bloques grandes aun pendientes

Todavia no esta implementado o no esta cerrado del todo:

- tracking GPS fino tipo ridesharing v2
- notificaciones avanzadas
- colas / jobs para procesos pesados
- produccion real endurecida
- mobile
- pagos
- multiples evidencias por reporte

---

## 7. Orden recomendado para continuar

Orden profesional sugerido:

1. hacer commit detallado del bloque actual
2. ejecutar QA manual del flujo nuevo de ejecucion operativa
3. ejecutar QA transversal web completo
4. corregir hallazgos reales
5. cerrar `Release Readiness Web`
6. recien despues abrir otro frente grande

Si se quiere seguir funcionalmente despues de eso, el orden mas sano seria:

1. endurecimiento final post-viaje
2. tracking GPS v2
3. notificaciones
4. mobile
5. pagos

---

## 8. Riesgos o puntos sensibles actuales

- el sistema ya tiene muchos modulos integrados; ahora el riesgo principal son regresiones por cruces entre estados
- la ejecucion del viaje ya no debe tratarse como un simple `in progress / completed`
- cualquier cambio futuro en viajes debe respetar:
  - estado global del viaje
  - estado de solicitud
  - estado operativo del pasajero
- antes de meter tracking v2 o notificaciones, conviene cerrar bien la consistencia del flujo actual

---

## 9. Fuente de verdad recomendada

Para el siguiente chat, usar como referencia principal:

- `Docs/10_HANDOFF_ESTADO_ACTUAL_Y_PENDIENTES.md`
- `Docs/08_RELEASE_READINESS_WEB.md`
- `Docs/09_CHECKLIST_QA_WEB_RELEASE.md`
- `Docs/00_REQUERIMIENTOS_BASE.md`

Y complementar con:

- `Docs/07_ENTORNO_QA_DEPLOY.md`

---

## 10. Resumen ejecutivo

Ya esta implementado:

- acceso
- perfil
- conductor
- vehiculos
- viajes
- solicitudes
- tracking v1
- confianza
- auditoria
- ejecucion operativa del viaje v1

Falta cerrar:

- QA manual transversal
- commit ordenado del bloque reciente
- release readiness web final

No conviene abrir todavia:

- pagos
- mobile
- tracking GPS fino v2

Hasta no cerrar la pasada final web con criterio de release.
