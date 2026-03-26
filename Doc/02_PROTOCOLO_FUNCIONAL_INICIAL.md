# SafeRidePro - Prototipo funcional inicial

---

## 1. Objetivo del sistema

Construir una plataforma de transporte compartido seguro para estudiantes verificados de una misma institucion, permitiendo publicar viajes, solicitar cupos, coordinar recogidas y gestionar reputacion, reportes y reglas de seguridad.

---

## 2. Roles del sistema

### 2.1 Estudiante pasajero

- Se registra con correo institucional.
- Completa su perfil.
- Busca viajes disponibles.
- Solicita unirse a un viaje.
- Visualiza el estado de sus solicitudes.
- Confirma su participacion.
- Califica y reporta despues del viaje.

### 2.2 Estudiante conductor

- Se registra con correo institucional.
- Completa su perfil.
- Publica viajes con coordenadas exactas.
- Define el modo del viaje.
- Gestiona solicitudes recibidas.
- Confirma pasajeros.
- Inicia y finaliza el viaje.
- Califica y reporta despues del viaje.

### 2.3 Administrador

- Revisa reportes y evidencias.
- Aplica advertencias o suspensiones.
- Administra parametros globales.
- Supervisa usuarios y trazabilidad basica.

### 2.4 Observacion importante

Un mismo usuario puede actuar como pasajero y conductor, siempre que su perfil tenga habilitado el uso como conductor.

---

## 3. Conceptos funcionales principales

### 3.1 Viaje

Es una publicacion creada por un conductor con:

- origen exacto
- destino exacto
- fecha y hora de salida
- cupos disponibles
- reglas o notas
- modo del viaje
- precio base

### 3.2 Solicitud

Es la peticion que hace un pasajero para unirse a un viaje publicado.

### 3.3 Participacion confirmada

Es el estado alcanzado cuando el conductor acepta la solicitud y el sistema reserva el cupo para el pasajero.

### 3.4 Reputacion

Es el resultado visible de calificaciones, cantidad de viajes y comportamiento reportado del usuario.

---

## 4. Modos de viaje propuestos

### 4.1 Modo 1: ruta fija

Nombre tecnico sugerido: `FIXED_ROUTE`

- El conductor sigue una ruta definida.
- No realiza desvios para dejar al pasajero en su casa.
- Puede hacer paradas dentro de la ruta prevista.
- El pasajero debe ajustarse a los puntos de recogida o bajada definidos por el conductor.
- Usa un precio estandar.

### 4.2 Modo 2: ruta con desvio

Nombre tecnico sugerido: `WITH_DETOUR`

- El conductor acepta salir de la ruta principal para dejar al pasajero mas cerca o en la puerta de su casa.
- El sistema debe limitar el desvio a una distancia maxima permitida.
- El precio del viaje es mayor que el de una ruta fija.
- El precio adicional debe considerar al menos la distancia extra y el retorno del conductor a su ruta original.

### 4.3 Regla provisional para desvio

Se recomienda manejar dos parametros:

- `maxDetourDistanceKm`: distancia maxima de desvio permitida por la plataforma
- `detourRatePerKm`: valor adicional por kilometro de desvio

Formula provisional sugerida:

`finalPrice = basePrice + (extraDistanceKm * detourRatePerKm * 2)`

El multiplicador `2` representa ida y retorno del desvio. Esta formula es provisional y puede cambiar en el documento funcional definitivo.

---

## 5. Flujo general del sistema

### 5.1 Registro y verificacion

1. El estudiante crea una cuenta con correo institucional.
2. El sistema envia codigo o enlace de verificacion.
3. El estudiante verifica su cuenta.
4. El sistema habilita el acceso.

### 5.2 Completar perfil

1. El usuario ingresa nombre, carrera, foto opcional y telefono opcional.
2. El usuario registra su ubicacion principal.
3. Si desea conducir, habilita el modo conductor.
4. El sistema guarda el perfil y reglas de seguridad aceptadas.

### 5.3 Publicacion de viaje

1. El conductor crea un viaje.
2. Ingresa origen y destino exactos.
3. Define fecha, hora y cupos.
4. Selecciona el modo del viaje:
   `FIXED_ROUTE` o `WITH_DETOUR`
5. Ingresa precio base.
6. Si elige `WITH_DETOUR`, el sistema aplica reglas de distancia maxima y tarifa adicional.
7. El viaje queda publicado.

### 5.4 Busqueda de viajes

1. El pasajero busca viajes por origen, destino, fecha, hora o disponibilidad.
2. El sistema muestra tarjetas con informacion relevante:
   conductor, reputacion, modo del viaje, precio estimado, hora y cupos.
3. El pasajero revisa reglas de seguridad y detalles del viaje.

### 5.5 Solicitud de cupo

1. El pasajero envia solicitud para unirse.
2. El sistema registra la solicitud como pendiente.
3. El conductor recibe la solicitud.
4. El conductor acepta o rechaza.
5. Si acepta, el sistema reserva el cupo y crea la participacion confirmada.

### 5.6 Ejecucion del viaje

1. Antes de salir, el conductor puede marcar el viaje como listo o iniciado.
2. Los pasajeros confirmados visualizan datos operativos del viaje.
3. Si existe tracking en vivo, el sistema comparte la ubicacion del conductor solo durante el viaje activo.
4. El conductor marca el viaje como finalizado al terminar.

### 5.7 Cierre del viaje

1. El sistema habilita calificaciones mutuas.
2. Pasajero y conductor pueden dejar reseña.
3. Si hubo incidencia, cualquiera puede reportar.
4. El sistema actualiza reputacion y trazabilidad.

### 5.8 Moderacion administrativa

1. El administrador revisa reportes.
2. Evalua evidencia y contexto.
3. Aplica accion si corresponde:
   advertencia, suspension temporal o cierre del caso.
4. El sistema registra la resolucion.

---

## 6. Estados sugeridos

### 6.1 Estados de viaje

- `DRAFT`
- `PUBLISHED`
- `FULL`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`

### 6.2 Estados de solicitud

- `PENDING`
- `ACCEPTED`
- `REJECTED`
- `CANCELLED`

### 6.3 Estados de reporte

- `PENDING`
- `UNDER_REVIEW`
- `RESOLVED`
- `DISMISSED`

---

## 7. Reglas de negocio iniciales

- Solo pueden acceder usuarios con correo institucional verificado.
- Las coordenadas exactas forman parte del modelo del viaje y del perfil operativo del usuario.
- El conductor controla la aceptacion de solicitudes.
- El sistema no procesa pagos en esta etapa.
- El precio mostrado es informativo y sirve para coordinacion entre estudiantes.
- El modo `WITH_DETOUR` solo puede aplicarse si el desvio calculado no supera el limite permitido.
- La reputacion del usuario debe considerar promedio de calificaciones y numero de viajes completados.
- Los reportes deben aceptar evidencia opcional.
- Las reglas de seguridad deben ser visibles antes de confirmar un viaje.

---

## 8. Consideraciones de privacidad y seguridad

- Aunque se usen coordenadas exactas, no conviene exponerlas a cualquier usuario desde el primer momento.
- Se recomienda mostrar informacion detallada solo a usuarios autenticados y, de ser posible, solo cuando exista solicitud o confirmacion.
- La ubicacion en tiempo real debe estar limitada al periodo activo del viaje.
- Todo evento importante debe registrarse en auditoria.

---

## 9. Modulos funcionales iniciales

- Autenticacion y verificacion institucional
- Gestion de perfiles
- Gestion de conductores
- Publicacion y busqueda de viajes
- Solicitudes y confirmaciones
- Calculo de precio base y precio con desvio
- Calificaciones y reputacion
- Reportes y moderacion
- Auditoria y trazabilidad

---

## 10. Arquitectura sugerida para el backend

### Recomendacion

Usar una arquitectura **modular con Clean Architecture ligera**, no Onion pura.

### Motivo

- Mantiene el codigo ordenado por dominio.
- Facilita pruebas y crecimiento.
- Evita el exceso de capas ceremoniales de una implementacion demasiado academica.
- Encaja muy bien con NestJS.

### Estructura sugerida por modulo

- `domain`
- `application`
- `infrastructure`
- `presentation`

Cada modulo del backend deberia vivir por feature, por ejemplo:

- `auth`
- `users`
- `drivers`
- `trips`
- `trip-requests`
- `ratings`
- `reports`
- `audit`

---

## 11. Estructura inicial recomendada del repositorio

Si, conviene definir la estructura base desde ahora, aunque todavia no implementemos todo.

Estructura sugerida:

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

### Nota

- `mobile` puede existir desde el inicio aunque se implemente despues.
- `shared-types` sirve para tipos comunes entre web, api y mobile.
- La implementacion principal puede arrancar primero con `api` y `web`.

---

## 12. Pendientes para el documento funcional final

- Definir si el conductor requiere validacion adicional para habilitarse como conductor.
- Definir formula final de precios.
- Definir si el pasajero elige punto exacto o solo confirma direccion final.
- Definir politicas de cancelacion.
- Definir visibilidad exacta de coordenadas segun etapa del flujo.
- Definir si el tracking en vivo estara en web, mobile o ambos.
