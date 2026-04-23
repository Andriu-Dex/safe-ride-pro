# 02_DISENO_PRUEBAS_INTEGRACION_Y_SISTEMA

## 1. Objetivo

Traducir el plan de pruebas en suites concretas de validacion para `SafeRidePro`, con foco en pruebas de integracion y pruebas de sistema aplicables al estado actual del proyecto.

---

## 2. Principios de diseno

- cubrir flujos con mayor riesgo de regresion
- priorizar integraciones reales entre capas
- validar reglas de negocio criticas y estados borde
- mantener trazabilidad con requerimientos y politicas operativas
- evitar duplicar pruebas que ya no agregan valor

---

## 3. Suites de pruebas de integracion

## 3.1 Identidad y acceso

Objetivo:

- validar integracion entre endpoints, persistencia, sesiones y reglas de acceso institucional

Escenarios clave:

- registro con dominio permitido
- rechazo por dominio no permitido
- verificacion de correo
- reenvio de codigo
- login
- forgot password
- reset password
- refresh
- logout

## 3.2 Perfil e incorporacion institucional

Objetivo:

- validar actualizacion de perfil y resolucion del contexto institucional operativo

Escenarios clave:

- lectura del perfil actual
- actualizacion de datos editables
- reflejo correcto del onboarding
- degradacion operativa si la institucion no esta activa

## 3.3 Onboarding de conductor y documentos

Objetivo:

- validar integracion de carga, persistencia, revision y consulta de documentos

Escenarios clave:

- envio de solicitud
- carga de documento de identidad
- carga de licencia
- aprobacion administrativa
- rechazo con nota
- bloqueo de auto revision

## 3.4 Vehiculos

Objetivo:

- validar persistencia, reglas de negocio y relacion con conductor/documentos

Escenarios clave:

- registro de vehiculo
- activacion o desactivacion
- carga y consulta de matricula
- reglas por catalogo

## 3.5 Viajes y solicitudes

Objetivo:

- validar integracion entre viajes, solicitudes, cupos y transiciones de estado

Escenarios clave:

- creacion y publicacion de viaje
- exploracion y filtros
- solicitud de cupo
- aceptacion y rechazo
- cancelacion de solicitud
- cierre de pendientes al iniciar viaje

## 3.6 Ejecucion operativa del viaje

Objetivo:

- validar la nueva capa operativa de solicitudes aceptadas durante el viaje

Escenarios clave:

- marcar pasajero como abordado
- marcar pasajero como finalizado
- registrar no-show antes del abordaje
- bloquear no-show si el pasajero ya esta a bordo o finalizado
- exigir `closureNote` si existen pasajeros aceptados sin resolver
- completar viaje con cierre excepcional valido
- generacion de auditoria operativa asociada

Datos criticos a validar:

- `Trip.status`
- `TripRequest.status`
- `TripRequest.executionStatus`

## 3.7 Confianza, reportes, sanciones y apelaciones

Objetivo:

- validar elegibilidad post-viaje y coherencia administrativa

Escenarios clave:

- calificacion post-viaje
- reporte con evidencia
- reporte sin evidencia
- severidad alta con paso obligatorio por revision
- sancion activa visible
- apelacion permitida o bloqueada segun estado

## 3.8 Auditoria administrativa

Objetivo:

- validar trazabilidad y navegacion cruzada entre modulos administrativos

Escenarios clave:

- revision de conductores
- revision de reportes
- resolucion o desestimacion
- levantamiento manual de sancion
- revision de apelaciones

---

## 4. Suites de pruebas de sistema

## 4.1 Flujo E2E de acceso y primer uso

Precondicion:

- institucion activa con dominio permitido

Resultado esperado:

- el usuario puede registrarse, verificar correo, iniciar sesion y entrar a la app sin bloqueos

## 4.2 Flujo E2E de conductor

Precondicion:

- usuario autenticado y operativo

Resultado esperado:

- el usuario solicita habilitacion como conductor, un admin revisa y la decision queda reflejada correctamente

## 4.3 Flujo E2E de viaje

Precondicion:

- conductor aprobado con vehiculo operativo

Resultado esperado:

- el conductor publica viaje, el pasajero solicita cupo y el conductor decide correctamente

## 4.4 Flujo E2E de ejecucion operativa

Precondicion:

- viaje iniciado con solicitud aceptada

Resultado esperado:

- el conductor puede marcar abordaje y finalizacion
- el pasajero ve su estado operativo
- no-show y cierre excepcional obedecen reglas vigentes

## 4.5 Flujo E2E de confianza y auditoria

Precondicion:

- viaje cerrado o incidente operativo elegible

Resultado esperado:

- el pasajero puede calificar o reportar
- el admin puede revisar el caso y navegar su contexto cruzado

---

## 5. Casos borde prioritarios

- viaje iniciado con solicitudes pendientes
- viaje finalizado con pasajeros aceptados sin resolver
- intento de no-show despues de abordaje
- licencia vencida al intentar operar
- institucion inactiva con sesion ya abierta
- reporte de alta severidad sin nota administrativa suficiente
- sancion con apelacion pendiente
- upload/documento tras retorno del selector de archivos

---

## 6. Cobertura minima por tipo

### Integracion backend

- endpoints criticos cubiertos por pruebas HTTP
- reglas de persistencia y migracion coherentes
- auditoria generada cuando corresponde

### Sistema automatizado

- smoke E2E alineado con la UI actual
- verificaciones base reproducibles desde comandos `pnpm`

### Sistema manual

- recorrido transversal por modulo
- validacion visual y funcional
- validacion de mensajes, estados vacios y acciones bloqueadas

---

## 7. Plantilla de caso de prueba

Se recomienda documentar los casos relevantes con la siguiente estructura:

### ID

- ejemplo: `SYS-TRIP-EXEC-001`

### Modulo

- viajes
- solicitudes
- confianza
- auditoria

### Nivel

- integracion
- sistema

### Tipo

- funcional
- no funcional
- caja negra
- caja blanca

### Precondiciones

- datos y estado requeridos antes de ejecutar la prueba

### Pasos

1. accion inicial
2. accion secundaria
3. validacion final

### Resultado esperado

- comportamiento observable esperado

### Prioridad

- alta
- media
- baja

### Estado de ejecucion

- pendiente
- aprobado
- fallido
- bloqueado

---

## 8. Casos iniciales recomendados para esta fase

### SYS-TRIP-EXEC-001

Objetivo:

- validar abordaje exitoso de pasajero aceptado

### SYS-TRIP-EXEC-002

Objetivo:

- validar finalizacion exitosa de pasajero a bordo

### SYS-TRIP-EXEC-003

Objetivo:

- bloquear no-show si el pasajero ya fue abordado

### SYS-TRIP-EXEC-004

Objetivo:

- exigir nota excepcional al cerrar viaje con pasajeros aceptados sin resolver

### SYS-TRUST-001

Objetivo:

- validar reporte post-viaje con evidencia

### SYS-AUDIT-001

Objetivo:

- validar revision administrativa de reporte y navegacion cruzada

---

## 9. Referencia operativa

Para la ejecucion real de esta fase, complementar este documento con:

- `Docs/09_CHECKLIST_QA_WEB_RELEASE.md`
- `Docs/Pruebas/03_REPORTE_EJECUCION_QA.md`
