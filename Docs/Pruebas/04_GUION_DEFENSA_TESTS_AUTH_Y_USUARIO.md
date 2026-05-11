## 1. Presentacion general del proyecto

`SafeRidePro` es una plataforma web orientada a transporte compartido seguro para estudiantes de una misma institucion.

El sistema permite:

- registro con correo institucional
- verificacion de identidad
- gestion de perfil
- incorporacion de conductor
- registro de vehiculos
- publicacion y solicitud de viajes
- seguimiento de la operacion del viaje
- calificaciones y reportes
- moderacion y auditoria administrativa

El objetivo principal del proyecto es ofrecer una solucion organizada, segura y trazable para coordinar viajes entre miembros verificados de una comunidad universitaria.

---

## 2. Lenguaje y herramientas utilizadas en el proyecto

El proyecto fue desarrollado principalmente con `TypeScript`, tanto en frontend como en backend.

Las herramientas y tecnologias principales que utiliza el proyecto son:

- `TypeScript` como lenguaje base
- `Node.js` como entorno de ejecucion
- `Next.js` para la aplicacion web
- `NestJS` para la API backend
- `Prisma ORM` para el acceso a base de datos
- `PostgreSQL` como base de datos relacional
- `pnpm` para la gestion de paquetes
- `Turborepo` para la organizacion del monorepo
- `Jest` para pruebas unitarias e integracion en backend
- `Vitest` y `Testing Library` para pruebas unitarias en frontend
- `Playwright` para pruebas end-to-end

En esta defensa, el foco se encuentra en pruebas unitarias del backend, por lo que la herramienta protagonista es `Jest`.

---

## 3. Que se quiso validar en esta entrega

En esta entrega se priorizaron cuatro flujos fundamentales del sistema:

- inicio de sesion
- registro de usuario
- recuperacion de contrasena
- edicion de usuario

Estos flujos fueron seleccionados porque constituyen la base de acceso y uso del sistema.

Sin estos procesos funcionando de forma correcta, segura y consistente, el resto de modulos del proyecto no podria operar de manera confiable.

---

## 4. Como se implementaron las pruebas unitarias

Las pruebas unitarias se implementaron sobre los `use cases` del backend.

Un `use case` representa una accion concreta del sistema y concentra la logica de negocio de una funcionalidad.

En lugar de probar directamente la interfaz o la base de datos, se probaron las reglas internas de cada flujo de forma aislada.

Para lograr esto, se usaron `mocks` con `jest.fn()` sobre dependencias como:

- repositorios
- servicios de auditoria
- servicios de correo
- servicios de hash de contrasena
- servicios de sesion

Esto permitio verificar el comportamiento del sistema sin depender de:

- una base de datos real
- servicios externos de correo
- interfaz grafica
- navegador

De esta manera, las pruebas unitarias se centraron exclusivamente en responder si la logica de negocio se comporta correctamente ante distintos escenarios.

---

## 5. Explicacion de los tests implementados

### 5.1 Inicio de sesion

Para `inicio de sesion`, las pruebas validan que el sistema:

- permita el acceso cuando el correo y la contrasena son correctos
- rechace credenciales invalidas
- rechace usuarios que aun no han verificado su correo
- registre eventos de auditoria en los casos de exito y error

Esto demuestra que el acceso no depende solo de que la contrasena coincida, sino tambien del estado real de la cuenta.

### 5.2 Registro de usuario

Para `registro`, las pruebas validan que el sistema:

- normalice correctamente el correo y los datos ingresados
- cree la cuenta y el codigo de verificacion
- rechace correos duplicados
- rechace numeros de cedula invalidos
- rechace numeros de telefono invalidos
- registre el evento de auditoria correspondiente

Esto demuestra que el sistema no solo crea usuarios, sino que tambien protege la calidad y consistencia de los datos desde el primer momento.

### 5.3 Recuperacion de contrasena

Para `recuperacion de contrasena`, las pruebas validan dos momentos:

Primero, la solicitud del codigo de recuperacion:

- responde de forma segura aunque el correo no exista
- genera un codigo de recuperacion si la cuenta es valida
- aplica control de espera para evitar solicitudes repetidas en poco tiempo

Segundo, el restablecimiento de la contrasena:

- rechaza codigos invalidos o expirados
- impide reutilizar la misma contrasena anterior
- actualiza la contrasena correctamente
- invalida sesiones anteriores y marca el codigo como usado

Esto demuestra que el proceso de recuperacion fue tratado como un flujo de seguridad y no solo como un cambio simple de texto.

### 5.4 Edicion de usuario

Para `edicion de usuario`, las pruebas validan que el sistema:

- rechace telefonos invalidos
- normalice campos opcionales antes de guardarlos
- actualice correctamente los datos del perfil
- complete el onboarding cuando se cumplen todos los requisitos
- obligue a respetar reglas como aceptacion de terminos cuando corresponda

Esto demuestra que la gestion del perfil no solo modifica datos visibles, sino que tambien impacta el estado operativo del usuario dentro de la plataforma.

---

## 6. Resultado de la ejecucion

El bloque prioritario de pruebas ejecutado corresponde a:

- `login.use-case.spec.ts`
- `register-user.use-case.spec.ts`
- `forgot-password.use-case.spec.ts`
- `reset-password.use-case.spec.ts`
- `update-current-user.use-case.spec.ts`

En conjunto, estas pruebas verifican `19 escenarios` distribuidos en `5 suites`.

El resultado esperado para la demostracion es que todas las pruebas pasen correctamente, evidenciando que la base de autenticacion y gestion de usuario del sistema se encuentra validada a nivel unitario.

---

## 7. Relacion con el resto del proyecto

Aunque esta defensa se enfoca en autenticacion y gestion de usuario, estas pruebas forman parte de una estrategia mayor.

El resto del proyecto incluye modulos ya implementados como:

- conductor
- vehiculos
- viajes
- reservas
- ejecucion operativa del viaje
- confianza
- reportes
- auditoria
- configuracion administrativa
- tracking GPS
- pagos en entorno sandbox

Las pruebas de hoy son relevantes porque estos modulos dependen de que el acceso, la identidad del usuario y el perfil funcionen correctamente.

Por ejemplo:

- un usuario no puede solicitar viajes si su cuenta no esta bien registrada
- un conductor no puede operar si su identidad y contexto de usuario no estan correctos
- la trazabilidad administrativa depende de cuentas y estados bien definidos

Por eso, probar primero esta base funcional fue una decision tecnica prioritaria y coherente.

---

## 8. Cierre sugerido para la defensa

Como cierre, se puede indicar lo siguiente:

`En conclusion, las pruebas unitarias implementadas validan de forma aislada y precisa la logica central de autenticacion y gestion de usuario en SafeRidePro. Esto permite asegurar que el sistema responde correctamente ante escenarios validos y ante errores esperados, y proporciona una base confiable para continuar con pruebas sobre viajes, reservas y operacion del sistema completo.`

---

## 9. Comando de demostracion

Para ejecutar el bloque prioritario de pruebas unitarias, se puede usar:

```powershell
corepack pnpm --filter @saferidepro/api test:priority:auth-profile
```

Si se desea una salida mas demostrativa, mostrando cada caso individual:

```powershell
corepack pnpm --filter @saferidepro/api exec jest --config ./jest.config.js --runInBand --verbose test/unit/auth/login.use-case.spec.ts test/unit/auth/register-user.use-case.spec.ts test/unit/auth/forgot-password.use-case.spec.ts test/unit/auth/reset-password.use-case.spec.ts test/unit/users/update-current-user.use-case.spec.ts
```
