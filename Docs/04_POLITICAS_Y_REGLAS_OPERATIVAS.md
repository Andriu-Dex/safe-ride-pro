# SafeRidePro - Politicas y reglas operativas

## 1. Contenido

- politicas de verificacion
- politicas de cancelacion
- reglas por tipo de vehiculo
- visibilidad de ubicacion
- identidad y documentos
- reglas multiinstitucionales
- reputacion y bloqueos
- catalogos
- reportes y evidencia
- notificaciones
- seguridad
- decisiones futuras sobre pagos

---

## 2. Politica de verificacion de conductores

### 2.1 Tipo de verificacion

La verificacion del conductor sera **mixta**:

- el sistema valida que exista informacion obligatoria y documentos requeridos
- un admin institucional realiza la aprobacion o rechazo final

### 2.2 Tiempo objetivo

- ideal: menos de 12 horas
- maximo esperado en MVP: 24 horas

### 2.3 Reglas base

- un conductor no puede publicar viajes sin aprobacion
- una licencia vencida bloquea automaticamente el registro de nuevos vehiculos, la creacion, publicacion y el inicio de viajes
- un admin no puede revisar su propia solicitud de conductor
- solo pueden revisarse solicitudes ligadas a membresias activas
- todo rechazo debe registrar motivo
- el usuario puede reenviar documentacion corregida
- toda decision debe quedar auditada

### 2.4 Estados sugeridos

- `NOT_REQUESTED`
- `PENDING_VERIFICATION`
- `APPROVED`
- `REJECTED`
- `SUSPENDED`

---

## 3. Politica de identidad y documentos

### 3.1 Enfoque de MVP

En la primera version se manejara:

- carga de evidencia documental
- revision interna
- control de vigencia

No se implementara validacion automatica contra fuentes gubernamentales en esta fase.

### 3.2 Documentos admitidos

Para identidad:

- cedula ecuatoriana
- pasaporte

Para conductor:

- documento de identidad
- licencia vigente
- evidencia del vehiculo

### 3.3 Reglas de vigencia

- documento vencido: no se aprueba
- licencia vencida: el conductor no puede publicar nuevos viajes
- licencia vencida: el conductor tampoco puede registrar nuevos vehiculos, crear viajes ni iniciar viajes publicados
- documento proximo a vencer: se genera alerta
- licencia con menos de 30 dias de vigencia: se considera `EXPIRING_SOON` y debe mostrarse una alerta preventiva

### 3.4 Estados sugeridos para documentos

- `NOT_SUBMITTED`
- `PENDING_REVIEW`
- `APPROVED`
- `REJECTED`
- `EXPIRED`
- `RENEWAL_REQUIRED`

### 3.5 Automatizaciones permitidas

- validar archivo requerido
- validar formato de archivo
- validar fecha de expiracion
- notificar vencimiento proximo
- bloquear acciones al expirar licencia
- impedir aprobacion administrativa si faltan respaldo de identidad y respaldo de licencia

---

## 4. Politica de visibilidad de ubicacion

### 4.1 Antes de la aceptacion

Se muestra solo:

- zona aproximada de origen
- zona aproximada de destino
- datos generales del viaje

### 4.2 Despues de la aceptacion

Los participantes confirmados pueden ver:

- informacion precisa del encuentro
- origen exacto y destino exacto segun configuracion operativa

### 4.3 Durante viaje activo

El tracking en vivo, si esta habilitado, solo sera visible para:

- conductor
- pasajeros confirmados
- administradores autorizados en caso de soporte

### 4.4 Regla de privacidad

Las coordenadas exactas no deben mostrarse a:

- usuarios con solicitud pendiente
- usuarios rechazados
- usuarios externos
- usuarios que solo navegan por listados

---

## 5. Politica de cancelacion y no-show

### 5.1 Quien puede cancelar

- conductor: puede cancelar el viaje completo
- pasajero: puede cancelar su participacion

### 5.2 Ventana sugerida del MVP

- cancelacion a tiempo: hasta 30 minutos antes
- cancelacion tardia: menos de 30 minutos antes
- no-show: no cancela y no se presenta

### 5.3 Reglas operativas

- toda cancelacion debe quedar registrada
- toda cancelacion debe tener timestamp
- el sistema debe distinguir entre cancelacion a tiempo, tardia y no-show
- si el conductor cancela el viaje, las solicitudes `PENDING` y `ACCEPTED` deben cerrarse en cascada
- si un pasajero aceptado no se presenta, el conductor puede registrar `NO_SHOW` con nota obligatoria

### 5.4 Consecuencia funcional

La reputacion y las sanciones podran verse afectadas por:

- cancelaciones tardias
- no-show
- reincidencia

La formula exacta queda sujeta a ajustes posteriores.

### 5.5 Regla temporal de inicio del viaje

- un viaje solo puede iniciarse dentro de los 30 minutos previos a la salida programada
- un viaje no puede iniciarse si la hora estimada de llegada ya vencio
- si el viaje cambia de estado mientras un usuario lo esta viendo, la interfaz debe refrescar y reflejar el nuevo estado
- si un viaje inicia, las solicitudes pendientes deben cerrarse automaticamente para evitar estados inconsistentes

---

## 6. Reglas por tipo de vehiculo

### 6.1 Tipos iniciales

- `MOTORCYCLE`
- `CAR`
- `PICKUP_TRUCK`

### 6.2 Limites sugeridos

- motocicleta: 1 pasajero maximo
- automovil: hasta 4 pasajeros
- camioneta: hasta 5 pasajeros si aplica

### 6.3 Politica de equipaje sugerida

Valores posibles:

- `NOT_ALLOWED`
- `SMALL_ONLY`
- `UP_TO_MEDIUM`
- `LARGE_ALLOWED`

### 6.4 Reglas de configuracion

- el sistema define maximos por tipo de vehiculo
- el conductor puede elegir valores menores, nunca mayores
- la motocicleta debe tratarse como viaje individual y directo

---

## 7. Politica de ruta y desvio

### 7.1 Modalidades

- `DIRECT_ROUTE`
- `PLANNED_DETOUR`

### 7.2 Reglas de ruta directa

- no admite desvio personalizado
- no cambia precio por desvio
- solo admite puntos compatibles con la ruta principal

### 7.3 Reglas de desvio planificado

- el desvio debe solicitarse antes del inicio del viaje
- el desvio debe ser aprobado antes de confirmar
- el sistema debe validar que entre en el limite permitido
- el viaje puede aplicar recargo referencial

### 7.3.1 Reglas operativas sobre solicitudes

- una solicitud solo puede aceptarse mientras el viaje este `PUBLISHED` y todavia tenga cupos disponibles
- una solicitud pendiente puede rechazarse mientras el viaje siga `PUBLISHED` o `FULL`
- una solicitud del pasajero solo puede cancelarse mientras el viaje siga `PUBLISHED` o `FULL`
- si el viaje cambia a `IN_PROGRESS`, `COMPLETED` o `CANCELLED`, la interfaz no debe seguir ofreciendo acciones obsoletas

### 7.4 Regla critica

Una vez iniciado el viaje:

- no se permiten nuevos desvios
- no se renegocia el recorrido

### 7.5 Recomendacion del MVP

El recargo referencial debe ser simple:

- valor fijo configurable
- o formula simple configurable

---

## 8. Politica multiinstitucional

### 8.1 Principio general

El sistema sera multiinstitucional desde el modelo de datos.

### 8.2 Dominios institucionales

Una institucion puede tener varios dominios autorizados.

Se recomienda modelar:

- `Institution`
- `InstitutionDomain`

### 8.3 Administracion

- el `SUPER_ADMIN` crea instituciones
- el `SUPER_ADMIN` registra dominios
- el `SUPER_ADMIN` asigna el primer `INSTITUTION_ADMIN`

### 8.4 Regla del MVP

En la primera version:

- los viajes solo se comparten entre usuarios de la misma institucion
- no habra viajes cruzados entre instituciones
- los admins institucionales solo pueden operar sobre entidades de sus instituciones activas
- un admin institucional no puede revisar reportes en los que participa como reportante o reportado
- el sistema debe elegir como contexto operativo la membresia activa prioritaria dentro de una institucion activa
- si la membresia por defecto deja de ser operativa, el sistema debe caer a otra membresia activa disponible antes de bloquear al usuario
- si no existe ninguna membresia operativa, la web no debe seguir ofreciendo modulos operativos ni acciones de conductor, vehiculos, viajes o confianza
- una membresia `ACTIVE` dentro de una institucion inactiva no debe otorgar permisos administrativos ni operativos
- si una institucion se suspende mientras el usuario ya tiene la sesion abierta, la sesion puede seguir autenticada, pero debe degradarse a un estado no operativo
- la web debe resincronizar la sesion al recuperar foco y tambien de forma periodica para detectar suspensiones institucionales sin requerir nuevo login

### 8.5 Escalabilidad futura

El sistema debe quedar preparado para soportar politicas de interoperabilidad entre instituciones en una fase posterior.

---

## 9. Politica de reputacion y bloqueos

### 9.1 Principio

La reputacion no debe depender solo de estrellas.

Debe considerar:

- calificaciones
- cumplimiento
- cancelaciones
- no-show
- reportes confirmados

### 9.2 Regla funcional

La reputacion informativa y la sancion operativa deben tratarse por separado.

La reputacion resume comportamiento.  
La sancion restringe acciones concretas cuando existe reincidencia reciente.

Un usuario puede ser advertido, restringido o suspendido por:

- incumplimiento reiterado
- cancelaciones tardias
- no-show
- reportes resueltos por administracion

En esta version no se aplican sanciones automaticas fuertes por una calificacion baja aislada.

### 9.3 Decision de diseno

La formula exacta de reputacion agregada queda abierta para versiones posteriores, pero el sistema ya debe soportar:

- score agregado
- contador de viajes
- contador de incidentes
- historial de sanciones

### 9.4 Indicadores minimos ya soportados

El sistema debe poder calcular al menos:

- promedio de calificaciones recibidas
- total de calificaciones recibidas
- viajes completados como conductor
- viajes completados como pasajero
- cancelaciones tardias de viajes como conductor
- cancelaciones tardias de solicitudes como pasajero
- no-show registrados sobre la membresia del pasajero
- reportes resueltos recibidos

### 9.5 Tipos de sancion operativa

- `WARNING`: advertencia visible, sin bloqueo operativo
- `LIMITED_PASSENGER`: bloquea nuevas solicitudes de viaje
- `LIMITED_DRIVER`: bloquea crear, publicar e iniciar viajes
- `SUSPENDED`: bloquea operacion de movilidad como pasajero y conductor

### 9.6 Ventanas de evaluacion

- conducta operativa: ultimos `30` dias
- reportes resueltos: ultimos `60` dias
- reputacion promedio: valor informativo, no sancionador por si solo

### 9.7 Umbrales automaticos vigentes

#### 9.7.1 No-show de pasajero

- `2` en 30 dias: `WARNING`
- `3` en 30 dias: `LIMITED_PASSENGER` por `7` dias
- `4` o mas en 30 dias: `LIMITED_PASSENGER` por `14` dias

#### 9.7.2 Cancelaciones tardias de pasajero

- `2` en 30 dias: `WARNING`
- `3` en 30 dias: `LIMITED_PASSENGER` por `3` dias
- `4` o mas en 30 dias: `LIMITED_PASSENGER` por `7` dias

#### 9.7.3 Cancelaciones tardias de conductor

- `2` en 30 dias: `WARNING`
- `3` en 30 dias: `LIMITED_DRIVER` por `7` dias
- `4` o mas en 30 dias: `LIMITED_DRIVER` por `14` dias

#### 9.7.4 Reportes resueltos recibidos

- `1` reporte resuelto: seguimiento administrativo, sin sancion automatica fuerte
- `2` reportes resueltos en 60 dias: `SUSPENDED` por `7` dias
- `3` o mas reportes resueltos en 60 dias: `SUSPENDED` por `15` dias

### 9.8 Reglas de aplicacion tecnica

- las sanciones se aplican por `membership`, no por usuario global
- toda sancion activa debe quedar auditada
- toda sancion vencida debe quedar auditada
- la web debe mostrar la restriccion vigente y su fecha estimada de fin
- los endpoints deben bloquear acciones operativas segun el alcance de la sancion

### 9.9 Restricciones activas del MVP

`LIMITED_PASSENGER` bloquea:

- `createTripRequest`

`LIMITED_DRIVER` bloquea:

- `createTrip`
- `publishTrip`
- `startTrip`

`SUSPENDED` bloquea:

- `createTripRequest`
- `createTrip`
- `publishTrip`
- `startTrip`

---

## 10. Politica de catalogos

### 10.1 Responsables

- catalogos globales: `SUPER_ADMIN`
- configuracion institucional: `INSTITUTION_ADMIN`

### 10.2 Catalogos controlados

Se centralizan al menos:

- marcas de vehiculo
- modelos de vehiculo
- tipos de licencia
- tipos de vehiculo

### 10.3 Uso de `OTHER`

Se permitira `OTHER` para:

- marcas
- modelos

Reglas:

- el usuario debe escribir el valor manualmente
- el valor no se incorpora automaticamente al catalogo oficial
- queda sujeto a revision administrativa

### 10.4 Restriccion recomendada

Para tipos de licencia se prefiere un catalogo cerrado y validado.

---

## 11. Politica de reportes y evidencia

### 11.1 Tipos de archivo permitidos

Se recomienda permitir inicialmente:

- `JPG`
- `JPEG`
- `PNG`
- `PDF`
- `MP4`

### 11.2 Restricciones sugeridas

- imagen: hasta 5 MB
- PDF: hasta 10 MB
- video: hasta 25 MB
- maximo 3 a 5 archivos por reporte
- maximo total por reporte: hasta 30 MB

### 11.3 Retencion sugerida

- reportes resueltos: 12 meses
- reportes desestimados: 6 meses
- casos graves: mientras la sancion siga vigente y luego 12 meses adicionales

### 11.4 Reglas de almacenamiento

- acceso restringido
- nombres internos aleatorios
- validacion de tipo y tamano
- eliminacion o anonimizado al vencer el periodo de retencion

### 11.5 Reglas de revision administrativa

- un reporte pendiente puede pasar a `UNDER_REVIEW`
- un reporte solo puede cerrarse como `RESOLVED` o `DISMISSED` si existe nota administrativa
- un reporte cerrado no puede volver a estados abiertos
- toda revision administrativa debe quedar auditada

---

## 12. Politica de notificaciones

### 12.1 Clasificacion

#### Obligatorias

- verificacion de cuenta
- recuperacion de contrasena
- estado de verificacion como conductor
- vencimiento de documentos
- suspension o bloqueo
- incidentes graves
- cambios materiales en terminos o privacidad

#### Configurables

- recordatorios operativos no criticos
- nuevas solicitudes no urgentes
- calificacion pendiente

#### Opcionales

- promociones
- novedades
- mensajes informativos no criticos

### 12.2 Canales sugeridos

- push: operacion inmediata del viaje
- email: trazabilidad, cuenta, legal y soporte
- ambos: incidentes graves, suspensiones, rechazos sensibles y cambios legales

### 12.3 Tecnologia recomendada

- push: `Firebase Cloud Messaging`
- email: proveedor transaccional definido por backend

---

## 13. Politica de seguridad y auditoria

### 13.1 Logs

Se registraran al menos:

- autenticacion
- intentos fallidos de acceso
- cambios de contrasena
- cambios de rol
- verificacion de conductores
- cambios criticos de viajes
- reportes e intervenciones administrativas

### 13.2 Retencion sugerida

- logs operativos: 30 dias
- logs de seguridad y auditoria: 90 dias
- logs de incidentes: hasta cierre del caso o del ciclo definido

### 13.3 Reglas de auditoria

Toda accion critica debe registrar:

- quien la ejecuto
- fecha y hora
- accion
- entidad afectada
- valor anterior y nuevo cuando aplique
- resultado

### 13.4 Proteccion de documentos sensibles

Se exigira al menos:

- HTTPS/TLS
- almacenamiento privado
- control de acceso por roles
- nombres internos aleatorios
- no exponer rutas reales ni URLs publicas innecesarias

---

## 14. Politica legal minima para el proyecto

Deben existir textos base de:

- terminos de uso
- politica de privacidad
- disclaimer de responsabilidad

En fase academica o de prototipo, estos textos pueden ser funcionales y serios, pero si el proyecto escala a produccion real deberan revisarse legalmente en Ecuador.

---

## 15. Decision aplazada sobre pagos

Aqui es donde corrijo y ordeno una parte importante de tus respuestas:

Tus propuestas sobre `DEUNA`, `CASH`, estados de pago e impago son utiles, pero no deben entrar en el MVP porque ya cerramos esta decision:

- MVP: no procesa pagos
- fase futura: arquitectura con `PaymentProvider`
- proveedor preferido inicial: `DEUNA`
- proveedor alterno: `PayPal`

### Implicacion actual

Durante el MVP:

- no se modelan flujos de cobro operativos
- no se modelan estados de pago de negocio dentro del protocolo funcional principal
- no se aplican sanciones por impago dentro del flujo del MVP

### Implicacion futura

Cuando se abra la fase de pagos, se debera crear una version nueva de estas politicas para definir:

- pago anticipado digital
- pago en efectivo, si se habilita
- conciliacion y disputas
- sanciones por impago
- estados de pago
- confirmacion de cobro

---

## 16. Decision de modelado recomendada

Aunque ciertos temas aun no se implementen en el MVP, el sistema debe quedar preparado para crecer en:

- instituciones
- dominios institucionales
- reputacion agregada
- sanciones
- documentos con vigencia
- politicas por vehiculo
- notificaciones por categoria
- auditoria robusta
- pagos futuros mediante `PaymentProvider`
