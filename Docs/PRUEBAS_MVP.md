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

### 6. Filtros de viajes

Pasos:

1. En `/viajes`, aplicar filtros por origen, destino, fecha, modo de ruta y tipo de vehiculo
2. Limpiar filtros

Resultado esperado:

- cambian los resultados de `Mis viajes`
- cambian los resultados de `Viajes disponibles`
- el contador de filtros activos responde correctamente

### 7. Solicitud de cupo

Pasos:

1. Con otra cuenta buscar un viaje publicado
2. Solicitar cupo
3. Si el viaje es con desvio, enviar coordenadas personalizadas

Resultado esperado:

- la solicitud aparece en `Mis solicitudes` del pasajero
- la solicitud aparece en `Solicitudes recibidas` del conductor

### 8. Aceptacion de solicitud y avance del viaje

Pasos:

1. Conductor acepta la solicitud
2. Inicia el viaje
3. Completa el viaje

Resultado esperado:

- los cupos se descuentan al aceptar
- el viaje pasa por los estados esperados
- al completar, queda habilitado el flujo de confianza

### 9. Calificaciones

Pasos:

1. Entrar a `/confianza`
2. Registrar una calificacion pendiente

Resultado esperado:

- la tarjeta desaparece de pendientes
- la calificacion aparece en `Calificaciones emitidas`
- la contraparte la ve en `Calificaciones recibidas`

### 10. Reportes

Pasos:

1. Entrar a `/confianza`
2. Registrar un reporte pendiente con motivo y descripcion

Resultado esperado:

- el reporte aparece en `Mis reportes`
- la auditoria registra el evento de reporte creado

### 11. Auditoria y revision administrativa

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
- `trip-requests`
- `ratings`
- `reports`
- `revision administrativa`

La siguiente tanda recomendable de automatizacion es:

- ajuste de cupos en `trip-requests`
- `create-trip` y validaciones de solapamiento desde origen
- `institutions` y `users`
- pruebas de integracion HTTP para endpoints criticos
