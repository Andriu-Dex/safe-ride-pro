# PRUEBAS_MVP

## Objetivo

Este documento sirve como guia temporal para validar manualmente el MVP de `SafeRidePro` antes de avanzar con mas alcance funcional.

No es un documento permanente de producto. Se mantendra mientras el flujo siga ajustandose.

## Preparacion

Antes de probar:

- levantar PostgreSQL con la base ya migrada
- verificar `apps/api/.env`
- levantar backend y frontend

Comandos:

```powershell
corepack pnpm --dir apps/api dev
corepack pnpm --dir apps/web dev
```

## Credenciales semilla

Usuario administrativo inicial:

- correo: `admin@uta.edu.ec`
- contrasena: `Admin12345`

Este usuario puede:

- iniciar sesion
- revisar solicitudes de conductor
- revisar reportes administrativos
- consultar auditoria

## Escenario recomendado

Para probar el flujo completo conviene usar:

- una sesion como conductor o admin
- una segunda sesion como pasajero

Puedes usar dos navegadores, una ventana normal y otra en incognito, o bien Postman para algunas acciones.

## Pruebas manuales del MVP

### 1. Login y sesion protegida

Pasos:

1. Abrir `http://localhost:3000/login`
2. Ingresar con `admin@uta.edu.ec`
3. Confirmar redireccion al panel autenticado

Resultado esperado:

- el login responde correctamente
- la sesion queda protegida
- `Resumen`, `Viajes`, `Confianza` y `Auditoria` son accesibles

### 2. Solicitud de conductor

Pasos:

1. Entrar a `/conductor`
2. Enviar solicitud con licencia y datos requeridos
3. Confirmar que el estado cambie a pendiente

Resultado esperado:

- se registra la solicitud
- aparece mensaje de confirmacion
- el estado del conductor cambia en la interfaz

### 3. Revision de conductor

Pasos:

1. Con un admin ir a la accion de revision correspondiente
2. Aprobar la solicitud del conductor

Resultado esperado:

- el conductor queda en estado `APPROVED`
- la auditoria registra el evento

### 4. Registro de vehiculo

Pasos:

1. Entrar a `/vehiculos`
2. Registrar un vehiculo con marca, modelo y licencia validos

Resultado esperado:

- el vehiculo aparece en la lista de vehiculos propios
- el vehiculo queda disponible para crear viajes

### 5. Creacion y publicacion de viaje

Pasos:

1. Entrar a `/viajes`
2. Crear un viaje en borrador
3. Publicarlo

Resultado esperado:

- el viaje aparece en `Mis viajes`
- cambia de `DRAFT` a `PUBLISHED`
- la auditoria registra la publicacion

### 6. Sanciones operativas y confianza

Pasos:

1. Generar cancelaciones tardias o `no-show` de prueba dentro de la ventana operativa
2. Consultar `/confianza`
3. Intentar ejecutar una accion restringida desde `/viajes`

Resultado esperado:

- la vista de `Confianza` muestra advertencia o sancion activa
- la fecha estimada de fin aparece visible
- el backend bloquea la accion restringida
- la web deja claro si la restriccion afecta al rol de pasajero, conductor o ambos

### 7. Filtros de viajes

Pasos:

1. En `/viajes`, aplicar filtros por origen, destino, fecha, modo de ruta y tipo de vehiculo
2. Limpiar filtros

Resultado esperado:

- cambian los resultados de `Mis viajes`
- cambian los resultados de `Viajes disponibles`
- el contador de filtros activos responde correctamente

### 8. Solicitud de cupo

Pasos:

1. Con otra cuenta buscar un viaje publicado
2. Solicitar cupo
3. Si el viaje es con desvio, enviar coordenadas personalizadas

Resultado esperado:

- la solicitud aparece en `Mis solicitudes` del pasajero
- la solicitud aparece en `Solicitudes recibidas` del conductor

### 9. Aceptacion de solicitud y avance del viaje

Pasos:

1. Conductor acepta la solicitud
2. Inicia el viaje
3. Completa el viaje

Resultado esperado:

- los cupos se descuentan al aceptar
- el viaje pasa por los estados esperados
- al completar, queda habilitado el flujo de confianza

### 10. Calificaciones

Pasos:

1. Entrar a `/confianza`
2. Registrar una calificacion pendiente

Resultado esperado:

- la tarjeta desaparece de pendientes
- la calificacion aparece en `Calificaciones emitidas`
- la contraparte la ve en `Calificaciones recibidas`

### 11. Reportes

Pasos:

1. Entrar a `/confianza`
2. Registrar un reporte pendiente con motivo y descripcion

Resultado esperado:

- el reporte aparece en `Mis reportes`
- la auditoria registra el evento de reporte creado

### 12. Auditoria y revision administrativa

Pasos:

1. Entrar a `/auditoria`
2. Filtrar por accion, entidad o fechas
3. Revisar un reporte abierto

Resultado esperado:

- se listan eventos reales del sistema
- se listan reportes administrativos
- el reporte puede marcarse en revision, resolverse o desestimarse
- al revisar un reporte se crea un nuevo evento de auditoria

## Casos borde a verificar

- un usuario no puede solicitar su propio viaje
- no se puede solicitar un viaje sin cupos
- no se puede calificar dos veces la misma relacion en el mismo viaje
- no se puede reportar dos veces a la misma persona por el mismo viaje
- no se puede desestimar un reporte sin nota administrativa
- un usuario sin permisos administrativos no debe poder usar la bandeja de auditoria

## Estado actual de pruebas automatizadas

El backend ya cuenta con una primera base de pruebas unitarias para reglas criticas de negocio:

- `auth`
- `drivers`
- `vehicles`
- transiciones clave de `trips`
- `create-trip`
- ajuste de cupos y decisiones en `trip-requests`
- `trip-requests`
- `ratings`
- `reports`
- `revision administrativa`

Tambien ya existen pruebas HTTP de integracion ligera para endpoints criticos:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/trips`
- `GET /api/trips`
- `PATCH /api/trips/:tripId/publish`
- `POST /api/trip-requests`
- `GET /api/trip-requests/me`
- `PATCH /api/trip-requests/:requestId/accept`
- `POST /api/ratings`
- `GET /api/ratings/me`
- `POST /api/reports`
- `GET /api/reports/me`
- `GET /api/reports/inbox`
- `PATCH /api/reports/:reportId/review`

En frontend ya existen pruebas automaticas con `Vitest + Testing Library` para piezas criticas del panel web:

- `auth-storage`
- `AuthProvider`
- `LoginForm`
- `ProtectedRoute`
- `TripFiltersPanel`

Tambien ya existen pruebas end-to-end web con `Playwright` para flujos criticos del MVP sobre el entorno QA:

- login administrativo y acceso a auditoria
- solicitud de conductor, registro de vehiculo y publicacion de viaje
- flujo critico completo entre pasajero, conductor y admin

Comandos:

```powershell
corepack pnpm --dir apps/web test:e2e
corepack pnpm --dir apps/web test:e2e:headed
```

Si el entorno QA ya esta levantado y saludable, puedes reutilizarlo para acelerar las corridas:

```powershell
$env:PLAYWRIGHT_REUSE_QA='true'
corepack pnpm --dir apps/web test:e2e
```

Ademas, el backend ya cuenta con pruebas de integracion con base de datos real en un schema aislado de PostgreSQL para flujos criticos del MVP:

- registro, verificacion, login y consulta de perfil con persistencia real
- solicitud de conductor y aprobacion administrativa
- registro de vehiculo y creacion/publicacion de viaje
- solicitud de cupo, aceptacion, inicio y finalizacion del viaje
- calificacion, reporte y revision administrativa del reporte
- listado y creacion de instituciones con permisos reales
- actualizacion de perfil y lectura de membresias multiples
- validacion basica del modelo multiinstitucional con un usuario global y dos memberships

Comando:

```powershell
corepack pnpm --dir apps/api test:db
```

Por seguridad, `test:db` no usa el schema principal. Si no defines `TEST_DATABASE_URL`, el runner deriva uno a partir de `DATABASE_URL` usando `TEST_DATABASE_SCHEMA=integration_tests`.

En CI, este comando ya puede ejecutarse con un servicio efimero de PostgreSQL en GitHub Actions.

La siguiente tanda recomendable de automatizacion es:

- revision funcional y endurecimiento de casos borde del negocio
- ampliar smoke tests end-to-end a escenarios administrativos y errores de usuario
- pipeline de despliegue cuando ya exista ambiente objetivo
