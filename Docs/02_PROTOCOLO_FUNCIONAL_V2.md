# SafeRidePro - Protocolo funcional V2
## 1. Esta version se enfoca en:

- flujo de registro y acceso
- flujo de habilitacion de conductores
- flujo de gestion de vehiculos
- flujo de publicacion y busqueda de viajes
- flujo de solicitudes, confirmaciones y cancelaciones
- flujo de viaje activo y cierre
- flujo administrativo principal

Esta version no profundiza en politicas de seguridad, retencion, notificaciones, catalogos o aspectos legales; esos temas se documentan por separado.

---

## 2. Alcance funcional de referencia (MVP base)

En el MVP, SafeRidePro permitira:

- registro con correo institucional
- acceso por institucion
- uso del sistema como pasajero
- solicitud de habilitacion como conductor
- carga y revision de documentos del conductor
- registro de vehiculos
- publicacion de viajes
- busqueda y filtrado de viajes
- solicitud y aceptacion de cupos
- gestion de estados del viaje
- cancelacion de viaje o participacion
- calificaciones y reportes
- moderacion administrativa

### Decision importante del MVP

El MVP **no procesara pagos dentro de la app**.

La app podra mostrar:

- precio referencial
- recargo referencial por desvio planificado

Pero no ejecutara cobros ni conciliaciones dentro del sistema en esta fase.

### Estado de avance (abril 2026)

El bloque de acceso institucional del MVP base ya se encuentra implementado:

- registro institucional web
- verificacion por codigo
- reenvio de codigo
- login
- refresh token
- logout
- forgot/reset password

Con esto, el proyecto entra en etapa de implementacion funcional completa por modulos.

### Siguientes bloques de implementacion completa

Orden recomendado de ejecucion:

1. **Profile & Institutional Onboarding**
	- perfil base de usuario
	- membresia y contexto institucional activo
	- validaciones de operatividad institucional
2. **Driver Onboarding**
	- solicitud de conductor
	- documentos
	- revision administrativa
3. **Vehicle Management**
	- registro, edicion y estado de vehiculos
	- reglas por tipo de vehiculo
4. **Trips Core**
	- publicacion
	- busqueda y filtros
	- detalle de viaje
5. **Trip Requests & Operations**
	- solicitud/aceptacion/rechazo/cancelacion
	- inicio y cierre de viaje
	- no-show y cancelacion tardia
6. **Trust & Governance**
	- calificaciones
	- reportes
	- sanciones operativas y auditoria administrativa

---

## 3. Actores del sistema

### 3.1 Pasajero

Usuario verificado que puede buscar viajes, solicitar cupo, cancelar su participacion, completar viajes, calificar y reportar.

### 3.2 Conductor

Usuario verificado que, ademas de ser pasajero, ha sido aprobado para publicar viajes y operar con un vehiculo registrado.

### 3.3 Administrador institucional

Usuario con permisos para revisar conductores, moderar reportes, aplicar acciones sobre usuarios y administrar configuraciones propias de su institucion.

### 3.4 Super admin

Usuario global con permisos para gestionar instituciones, dominios institucionales, catalogos globales y asignacion de administradores institucionales.

---

## 4. Modelo operativo general

SafeRidePro sera multiinstitucional a nivel de arquitectura, pero cada viaje del MVP pertenecera a una sola institucion.

Reglas base:

- cada usuario pertenece a una institucion
- cada viaje pertenece a una institucion
- en el MVP, los viajes solo podran ser vistos y usados por usuarios de la misma institucion
- una institucion podra tener uno o varios dominios autorizados

---

## 5. Flujo de un usuario nuevo

### 5.1 Registro inicial

1. El usuario ingresa su correo institucional.
2. El sistema identifica la institucion por el dominio del correo.
3. Si el dominio es valido y esta activo, el sistema permite continuar.
4. El sistema envia codigo o enlace de verificacion.
5. El usuario valida su correo.
6. El usuario crea su contrasena.
7. El usuario completa su perfil basico.
8. El usuario acepta terminos, privacidad y reglas generales.
9. El usuario queda habilitado como pasajero activo.

### 5.2 Resultado del registro

Todo usuario nuevo entra primero como:

- usuario autenticado
- usuario verificado por correo
- pasajero activo
- no conductor

---

## 6. Flujo para convertirse en conductor

### 6.1 Inicio de solicitud

1. El usuario entra a su perfil.
2. Selecciona la opcion para solicitar habilitacion como conductor.
3. El sistema muestra requisitos y documentos obligatorios.

### 6.2 Carga de informacion

El usuario debe registrar:

- tipo y numero de documento
- licencia de conducir
- fecha de expiracion de licencia
- evidencia documental requerida
- uno o varios vehiculos

### 6.3 Revision de la solicitud

1. El sistema valida que la informacion minima este completa.
2. La solicitud entra en estado `PENDING_VERIFICATION`.
3. Un administrador institucional revisa la documentacion.
4. El admin aprueba o rechaza.
5. Si rechaza, debe registrar motivo.

### 6.4 Resultado

- si se aprueba, el usuario puede publicar viajes
- si se rechaza, el usuario puede corregir y reenviar

### 6.5 Regla del MVP

La verificacion del conductor sera **mixta**:

- validacion basica automatica por sistema
- aprobacion final por admin

---

## 7. Flujo de gestion de vehiculos

### 7.1 Registro de vehiculo

El conductor aprobado puede registrar un vehiculo con:

- tipo de vehiculo
- marca
- modelo
- anio
- color
- placa
- capacidad disponible
- politica de equipaje

### 7.2 Reglas base por tipo de vehiculo

En el MVP se manejaran tres tipos iniciales:

- motocicleta
- automovil
- camioneta

El sistema aplicara limites maximos segun el tipo.

Ejemplo de criterio funcional:

- motocicleta: 1 pasajero maximo
- automovil: hasta 4 pasajeros
- camioneta: hasta 5 pasajeros si aplica

### 7.3 Uso operativo

Un conductor puede tener vehiculos registrados, pero cada viaje debe vincularse a un solo vehiculo.

---

## 8. Flujo de publicacion de viaje

### 8.1 Creacion

1. El conductor elige un vehiculo registrado.
2. Define origen y destino.
3. Define fecha y hora.
4. Define cupos.
5. Define precio referencial base.
6. Define reglas del viaje.
7. Define politica de equipaje.
8. Define modalidad de ruta.
9. Publica el viaje.

### 8.2 Modalidades de ruta

#### Ruta directa

Nombre tecnico sugerido: `DIRECT_ROUTE`

Reglas:

- no admite desvio personalizado fuera de la ruta principal
- solo admite abordajes o bajadas coherentes con la ruta
- no genera recargo por desvio

#### Ruta con desvios planificados

Nombre tecnico sugerido: `PLANNED_DETOUR`

Reglas:

- permite desvio antes de iniciar el viaje
- el pasajero debe indicar el punto requerido antes de ser aceptado
- el sistema estima si el desvio entra dentro del limite permitido
- el viaje puede incluir un recargo referencial por desvio
- no se permiten nuevos desvios una vez iniciado el viaje

### 8.3 Regla sugerida para el MVP

Para el MVP, el recargo por desvio debe ser simple y predecible.

La opcion recomendada es:

- recargo fijo o formula simple configurable por administracion

---

## 9. Flujo de busqueda de viajes

### 9.1 Visualizacion en listado

El pasajero podra ver:

- institucion del viaje
- conductor y reputacion visible
- zona aproximada de origen
- zona aproximada de destino
- fecha y hora
- cupos disponibles
- modalidad de ruta
- politica de equipaje
- precio referencial

### 9.2 Filtros sugeridos

- origen
- destino
- fecha
- hora
- modalidad de ruta
- tipo de vehiculo
- disponibilidad

### 9.3 Regla de privacidad

En el listado no deben mostrarse coordenadas exactas.

---

## 10. Flujo de solicitud de cupo

### 10.1 Solicitud

1. El pasajero abre el detalle del viaje.
2. Revisa reglas, reputacion y datos visibles.
3. Si el viaje admite desvio planificado, el pasajero puede indicar su punto requerido antes de enviar la solicitud.
4. El pasajero envia la solicitud.
5. El sistema registra la solicitud como `PENDING`.

### 10.2 Revision por el conductor

1. El conductor revisa la solicitud.
2. Evalua el pasajero, reputacion, punto solicitado y compatibilidad con el viaje.
3. Acepta o rechaza.

### 10.3 Resultado

- si acepta, se reserva el cupo y el pasajero queda confirmado
- si rechaza, la solicitud cambia de estado y el cupo no se reserva

---

## 11. Flujo de confirmacion y visibilidad

### 11.1 Antes de aceptar la solicitud

El pasajero solo ve:

- zona aproximada de origen
- zona aproximada de destino
- informacion general del viaje

### 11.2 Despues de ser aceptado

El pasajero confirmado podra ver:

- datos necesarios del encuentro
- informacion mas precisa del viaje
- origen exacto y destino exacto segun la politica operativa definida

### 11.3 Durante viaje activo

Solo participantes confirmados y actores autorizados podran ver tracking en vivo si esa funcion esta habilitada.

---

## 12. Flujo de cancelacion

### 12.1 Cancelacion por pasajero

El pasajero puede cancelar su participacion antes del viaje.

### 12.2 Cancelacion por conductor

El conductor puede cancelar el viaje completo antes de iniciarlo.

### 12.3 Reglas operativas del MVP

- el sistema debe distinguir cancelacion a tiempo, cancelacion tardia y no-show
- el sistema debe registrar la cancelacion con marca de tiempo
- las penalizaciones de reputacion y medidas administrativas se definen en documento aparte

---

## 13. Flujo del viaje activo

### 13.1 Inicio del viaje

1. El conductor marca el viaje como iniciado.
2. El sistema cambia el estado a `IN_PROGRESS`.
3. Los participantes confirmados pueden ver informacion operativa del trayecto.

### 13.2 Durante el viaje

Reglas base:

- no se permiten nuevos desvios no aprobados previamente
- no se deben agregar nuevos pasajeros
- el sistema mantiene trazabilidad de eventos importantes

### 13.3 Finalizacion

1. El conductor marca el viaje como finalizado.
2. El sistema cambia el estado a `COMPLETED`.
3. Se habilitan calificaciones y reportes.

---

## 14. Flujo posterior al viaje

### 14.1 Calificaciones

Despues de finalizar un viaje:

- pasajero puede calificar al conductor
- conductor puede calificar al pasajero

### 14.2 Reportes

Si existio una incidencia:

- el usuario puede crear un reporte
- puede adjuntar evidencia segun reglas permitidas
- el reporte entra a revision administrativa

### 14.3 Reputacion

La reputacion del usuario se actualiza con base en:

- cumplimiento
- calificaciones
- cancelaciones
- reportes confirmados

La formula exacta se define fuera de este documento.

---

## 15. Flujo administrativo

### 15.1 Super admin

Puede:

- crear instituciones
- registrar dominios institucionales
- activar o desactivar instituciones
- asignar administradores institucionales
- administrar catalogos globales

### 15.2 Admin institucional

Puede:

- revisar y decidir verificaciones de conductores
- revisar reportes
- advertir, suspender o restringir usuarios segun reglas vigentes
- administrar configuraciones de su institucion

### 15.3 Regla de alcance

Un admin institucional solo puede operar sobre usuarios y viajes de su propia institucion.

---

## 16. Estados funcionales principales

### 16.1 Usuario

- `PENDING_EMAIL_VERIFICATION`
- `ACTIVE`
- `SUSPENDED`

### 16.2 Conductor

- `NOT_APPLIED`
- `PENDING_VERIFICATION`
- `APPROVED`
- `REJECTED`
- `SUSPENDED`

### 16.3 Viaje

- `DRAFT`
- `PUBLISHED`
- `FULL`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`

### 16.4 Solicitud

- `PENDING`
- `ACCEPTED`
- `REJECTED`
- `CANCELLED`

### 16.5 Reporte

- `PENDING`
- `UNDER_REVIEW`
- `RESOLVED`
- `DISMISSED`

---

## 17. Regla sobre pagos para esta V2

Aunque en respuestas.md se propusieron ideas utiles sobre DEUNA, efectivo y estados de pago, esas decisiones **no se incorporan al MVP** porque contradicen la definicion ya tomada:

- MVP: no procesa pagos
- fase futura: arquitectura preparada con `PaymentProvider`
- proveedor preferido inicial: `DEUNA`
- proveedor alterno: `PayPal`

Por lo tanto, en esta V2:

- se mantiene solo precio referencial
- no existen estados de pago funcionales dentro del MVP
- cualquier flujo de pago queda como decision futura

---

## 18. Documentos complementarios

Esta V2 debe leerse junto con:

- `01_STACK_TECNOLOGICO.md`
- `03_ESTRUCTURA_CLEAN_ARCHITECTURE.md`
- `04_POLITICAS_Y_REGLAS_OPERATIVAS.md`

---

## 19. Pendientes para V3

- definir formula final de reputacion
- definir formula exacta del recargo referencial por desvio
- definir si el origen exacto se muestra al aceptar o minutos antes de la salida
- definir si el tracking en vivo estara activo desde el MVP o fase posterior
- definir si un conductor podra tener varios vehiculos activos al mismo tiempo
- definir con mayor detalle el flujo de disputas o apelaciones administrativas
