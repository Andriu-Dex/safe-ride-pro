# SafeRidePro - Modelo multiinstitucional

## 1. Objetivo del documento

Definir como debe funcionar SafeRidePro cuando el sistema soporte una o varias instituciones educativas dentro de la misma plataforma.

Este documento responde especialmente a estas preguntas:

- como se modela la multiinstitucionalidad
- si conviene usar una base de datos unica o varias
- como se maneja un usuario que pertenece a varias instituciones
- como se controla la visibilidad de viajes entre instituciones
- como se evita que el mismo conductor publique viajes incompatibles entre si
- como dejar listo el sistema para crecer sin romper el MVP

---

## 2. Decision recomendada

La recomendacion para SafeRidePro es:

- usar **una sola base de datos**
- usar **un solo schema principal**
- modelar la multiinstitucionalidad mediante relaciones y reglas de acceso
- manejar una **identidad global del usuario**
- manejar **membresias por institucion**

Este enfoque se conoce normalmente como:

**shared database + shared schema multi-tenant design**

---

## 3. Que significa esto en la practica

No significa que cada institucion tenga su propia base de datos.

Significa que:

- todas las instituciones viven dentro del mismo sistema
- los datos se separan logicamente por `institution_id`
- los permisos, filtros y reglas definen que puede ver y hacer cada usuario
- la identidad del usuario puede existir una sola vez aunque participe en varias instituciones

---

## 4. Por que no se recomienda una base por institucion

Aunque a primera vista parece mas ordenado, para este proyecto no es la mejor opcion inicial.

### Problemas de una base por institucion

- complica mucho el login si un usuario pertenece a varias instituciones
- dificulta reportes globales y auditoria centralizada
- complica catalogos comunes como tipos de licencia o marcas de vehiculo
- hace mas costosa la infraestructura y el mantenimiento
- complica cambios de arquitectura en un proyecto universitario o startup
- dificulta futuros escenarios donde dos instituciones puedan interoperar

### Problema clave

Si el mismo usuario existe en dos bases distintas:

- ya no hay identidad global real
- se duplica informacion
- se rompen facilmente reglas como reputacion global, historial unico o bloqueo general

---

## 5. Por que no se recomienda multiesquema al inicio

El enfoque de multiples schemas en la misma base puede ser util en sistemas empresariales muy aislados por cliente, pero aqui tampoco es la mejor primera decision.

### Problemas de multiesquema temprano

- incrementa complejidad tecnica desde el primer dia
- hace mas dificil correr migraciones
- complica Prisma y herramientas de desarrollo
- hace mas complejo compartir catalogos globales
- sigue sin resolver elegantemente el caso de usuarios con varias instituciones

### Conclusion

Para SafeRidePro, ni base por institucion ni schema por institucion son la mejor primera arquitectura.

---

## 6. Modelo recomendado de alto nivel

El sistema deberia dividir estos conceptos:

- identidad global del usuario
- pertenencia del usuario a una institucion
- permisos del usuario dentro de una institucion
- recursos que pertenecen a una institucion

Esto evita confundir:

- quien es la persona
- en que institucion participa
- que permisos tiene en ese contexto

---

## 7. Entidades base recomendadas

### 7.1 User

Representa a la persona como identidad global del sistema.

Debe contener datos como:

- id
- email principal
- password hash
- nombre
- telefono
- tipo de documento
- numero de documento
- foto
- estado global de cuenta

### 7.2 Institution

Representa una universidad o institucion educativa.

Debe contener:

- id
- name
- code
- isActive

### 7.3 InstitutionDomain

Permite que una institucion tenga uno o varios dominios autorizados.

Debe contener:

- id
- institutionId
- domain
- isPrimary
- isActive

### 7.4 UserInstitutionMembership

Es la pieza clave del modelo multiinstitucional.

Representa la relacion entre un usuario y una institucion.

Debe contener como minimo:

- id
- userId
- institutionId
- role
- membershipStatus
- studentCode
- isDefault
- joinedAt

### 7.5 Trip

Cada viaje debe pertenecer a una institucion especifica.

Debe contener:

- id
- institutionId
- driverUserId
- vehicleId
- status
- departureAt
- routeMode

Opcionalmente se puede guardar tambien:

- driverMembershipId

si se quiere dejar absolutamente claro desde que contexto institucional se creo el viaje.

---

## 8. Diferencia entre usuario y membresia

Esta es una de las distinciones mas importantes.

### El usuario

Es la persona real.

Ejemplo:

- Juan Perez
- con una sola cuenta
- con un solo documento
- con un solo telefono

### La membresia

Es la forma en que ese usuario existe dentro de una institucion especifica.

Ejemplo:

- Juan es estudiante en UTA
- Juan tambien pertenece a otra institucion
- en cada institucion puede tener un codigo estudiantil distinto
- incluso podria tener permisos distintos

Entonces:

- un `User` puede tener muchas `UserInstitutionMembership`
- una `Institution` puede tener muchas `UserInstitutionMembership`

---

## 9. Como funcionaria un usuario con 2 instituciones

### Caso

Un estudiante pertenece a:

- UTA
- Institucion B

Entonces el sistema deberia manejar:

- una sola cuenta global
- dos membresias activas

### Que debe poder hacer

- elegir con que institucion esta operando
- ver viajes de la institucion activa
- publicar viajes dentro de la institucion activa
- tener configuraciones o permisos segun esa membresia

### Que no debe pasar

No se deben crear dos usuarios duplicados para la misma persona solo porque participa en dos instituciones.

---

## 10. Concepto de contexto institucional activo

Cuando un usuario tiene mas de una membresia, la interfaz y la API deben trabajar con la idea de:

**active institution context**

Es decir:

- el usuario inicia sesion una sola vez
- el sistema detecta o permite seleccionar su institucion activa
- las acciones operan dentro de ese contexto

Ejemplo:

- Juan entra y tiene 2 membresias
- selecciona UTA como contexto activo
- ve solo viajes y datos de UTA
- si luego cambia a otra institucion, cambia de contexto sin cambiar de cuenta

---

## 11. Reglas de visibilidad entre instituciones

### Regla recomendada para MVP y primera expansion

- un viaje pertenece a una sola institucion
- solo usuarios de esa misma institucion pueden verlo y solicitarlo

### Implicacion tecnica

Toda consulta importante debe validar:

- institucion del recurso
- membresia del usuario
- permisos dentro de esa institucion

### Preparacion futura

Aunque hoy se bloquee el cruce entre instituciones, el diseño debe permitir habilitarlo despues.

Se puede dejar preparada una politica futura como:

- `allowCrossInstitutionTrips`

o una tabla mas rica como:

- `InstitutionAccessPolicy`

con campos como:

- sourceInstitutionId
- targetInstitutionId
- canShareTrips

---

## 12. Como se manejan los roles en multiinstitucion

Los roles no deben depender solo del usuario global.

Lo correcto es que, al menos para muchos permisos, el rol viva en la membresia.

### Ejemplo

Juan puede ser:

- `STUDENT` en UTA
- `INSTITUTION_ADMIN` en Institucion B

Por eso no conviene guardar todo el rol solo en `users.role`.

### Recomendacion

Separar:

- rol global del sistema
- rol contextual por institucion

#### Rol global

Para casos como:

- `SUPER_ADMIN`

#### Rol por membresia

Para casos como:

- `STUDENT`
- `DRIVER`
- `INSTITUTION_ADMIN`

---

## 13. Como se maneja un viaje en multiinstitucion

Cada viaje debe guardar con claridad:

- quien lo creo
- en que institucion fue creado
- en que contexto institucional vive

### Recomendacion minima

Guardar en `Trip`:

- `institutionId`
- `driverUserId`

### Recomendacion mas robusta

Guardar tambien:

- `driverMembershipId`

Esto sirve para:

- saber desde que membresia se creo
- controlar permisos correctamente
- evitar ambiguedad si un usuario participa en varias instituciones

---

## 14. Caso especial: el mismo conductor quiere publicar 2 viajes al mismo tiempo

Este es un punto muy importante.

### Regla correcta

Aunque un usuario pertenezca a dos instituciones:

- sigue siendo la misma persona
- no puede conducir dos viajes simultaneos o incompatibles

### Implicacion

La validacion de conflictos no debe hacerse solo por institucion.

Debe hacerse globalmente por:

- `driverUserId`

### Regla de negocio recomendada

Un mismo conductor no puede tener:

- dos viajes `PUBLISHED`
- o un viaje `PUBLISHED` y otro `IN_PROGRESS`
- con horarios solapados

Esto aplica aunque los viajes pertenezcan a instituciones distintas.

### Ejemplo

No se debe permitir:

- viaje A a las 07:00 en UTA
- viaje B a las 07:10 en otra institucion

si claramente son incompatibles fisicamente.

---

## 15. Reglas de conflicto temporal recomendadas

El sistema deberia bloquear:

- publicaciones con solapamiento horario
- republicacion de viajes incompatibles
- cambios de horario que generen conflicto

### Recomendacion de diseno

Dejar desde temprano una capa de validacion de disponibilidad del conductor, centralizada y global.

Esa validacion no debe depender solo del modulo de viajes por institucion.

---

## 16. Como se maneja la reputacion en multiinstitucion

Aqui hay dos caminos validos.

### Opcion A: reputacion global

Una sola reputacion por usuario.

#### Ventajas

- mas simple
- evita duplicar calculos
- permite detectar comportamiento malo del usuario en cualquier institucion

#### Desventajas

- una mala experiencia en una institucion afecta la imagen en todas

### Opcion B: reputacion por membresia

Una reputacion distinta por cada institucion.

#### Ventajas

- mas precisa por contexto
- mas justa si las instituciones funcionan muy diferente

#### Desventajas

- mas compleja
- puede ocultar patrones globales de mal comportamiento

### Recomendacion para SafeRidePro

Usar un enfoque mixto:

- reputacion global del usuario
- metricas contextuales por institucion si luego hace falta

Para el MVP y primera expansion:

- basta con reputacion global

---

## 17. Como se manejan los admins en multiinstitucion

### Super admin

Tiene control global sobre:

- instituciones
- dominios
- catalogos globales
- asignacion inicial de admins institucionales

### Institution admin

Tiene control solo dentro de su institucion.

Puede gestionar:

- verificaciones de conductores
- reportes
- moderacion
- configuraciones institucionales

### Regla clave

Un `INSTITUTION_ADMIN` no puede ver ni alterar datos de otra institucion salvo que exista una politica excepcional futura.

---

## 18. Que tablas deberian llevar institutionId

En general, debe llevar `institutionId` toda entidad cuyo contexto pertenezca a una institucion.

### Ejemplos claros

- trips
- reports
- driver_verifications
- institution_rules
- institution_settings
- audit events de alcance institucional

### Ejemplos que pueden ser globales

- users
- institution_domains
- global catalogs

### Nota importante

No todo debe llevar `institutionId` por costumbre.

Debe llevarlo cuando el dato realmente pertenezca al contexto institucional.

---

## 19. Catalogos globales vs configuracion institucional

Esta separacion es importante para no mezclar responsabilidades.

### Catalogos globales

Deben vivir una sola vez para todo el sistema.

Ejemplos:

- tipos de vehiculo
- tipos de licencia
- marcas de vehiculo
- modelos de vehiculo

### Configuraciones institucionales

Deben vivir por institucion.

Ejemplos:

- dominios permitidos
- reglas visibles de seguridad
- tiempos de cancelacion
- si se permite o no cierta funcionalidad

---

## 20. Como se ve esto en base de datos

### Modelo simplificado recomendado

- `users`
- `institutions`
- `institution_domains`
- `user_institution_memberships`
- `vehicles`
- `trips`
- `trip_requests`
- `ratings`
- `reports`

### Relacion importante

- `users` no se duplica por institucion
- `user_institution_memberships` conecta usuarios con instituciones
- `trips` apunta a institucion y a usuario conductor

---

## 21. Como arrancar en MVP sin perder escalabilidad

Aunque hoy el MVP no necesite toda la complejidad de multiinstitucion real, si conviene dejar la base lista desde ahora.

### Recomendacion pragmatica

En el MVP se puede hacer esto:

- una sola institucion real activa
- uno o varios dominios en el modelo
- usuarios con una sola membresia activa
- sin interoperabilidad entre instituciones

Pero la base ya debe contemplar:

- `institutions`
- `institution_domains`
- `user_institution_memberships`

### Ventaja

Cuando el sistema crezca:

- no hay que redisenar toda la autenticacion
- no hay que migrar usuarios duplicados
- no hay que romper la logica de permisos

---

## 22. Estrategia de evolucion recomendada

### Etapa 1: MVP controlado

- una base
- un schema
- una institucion operativa principal
- modelo ya preparado para varias

### Etapa 2: multiinstitucion real

- varias instituciones activas
- multiples dominios
- super admin
- admins institucionales
- memberships por usuario

### Etapa 3: interoperabilidad opcional

- politicas entre instituciones
- visibilidad cruzada controlada
- reglas de acceso mas finas

### Etapa 4: aislamiento avanzado si algun dia hace falta

Solo si aparecen necesidades fuertes:

- compliance estricto
- clientes enterprise
- despliegues por tenant
- residencia separada de datos

Recien ahi se podria evaluar:

- multiesquema
- base por institucion

---

## 23. Riesgos e imprevistos que deben preverse

### 23.1 Usuarios duplicados

Si no se define identidad global, el mismo estudiante podria terminar con varias cuentas para distintas instituciones.

### 23.2 Roles ambiguos

Si el rol vive solo en `users.role`, sera dificil representar permisos distintos por institucion.

### 23.3 Recursos mal filtrados

Si una consulta no filtra por membresia e institucion, se pueden exponer viajes o reportes de otra institucion.

### 23.4 Conflictos de horario mal validados

Si el bloqueo de solapamiento se hace solo por institucion, el conductor podria publicar viajes incompatibles en otra institucion.

### 23.5 Futuras migraciones costosas

Si el MVP se construye asumiendo un solo `institution_id` fijo en `users`, luego ampliar a multiinstitucion real sera mucho mas costoso.

---

## 24. Reglas recomendadas para SafeRidePro

- El sistema utilizara una sola base de datos y un solo schema principal en sus primeras etapas.
- La identidad del usuario sera global y no se duplicara por institucion.
- La pertenencia de un usuario a una institucion se modelara mediante membresias.
- Cada viaje pertenecera a una institucion concreta.
- En la primera version, los viajes solo podran ser visibles y compartidos dentro de la misma institucion.
- Un mismo usuario podra pertenecer a varias instituciones en el futuro.
- Un mismo conductor no podra tener viajes con conflictos horarios aunque pertenezca a varias instituciones.
- Los catalogos generales del sistema seran globales y las configuraciones particulares viviran por institucion.
- El sistema quedara preparado para interoperabilidad futura entre instituciones, pero no la habilitara desde el MVP.

---

## 25. Decision final recomendada

Para SafeRidePro, la arquitectura multiinstitucional recomendada es:

- **una base de datos**
- **un schema principal**
- **usuarios globales**
- **membresias por institucion**
- **viajes ligados a una institucion**
- **validaciones globales por conductor**

Este enfoque equilibra:

- simplicidad inicial
- escalabilidad real
- menor riesgo de rediseno
- mejor control de permisos
- preparacion para crecimiento futuro

---

