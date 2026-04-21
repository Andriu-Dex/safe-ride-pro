# 00_REQUERIMIENTOS_BASE

## SafeRidePro: Transporte seguro compartido para estudiantes

En horarios nocturnos y/o de baja afluencia, muchos estudiantes tienen dificultades para movilizarse de forma segura y económica entre su casa y la institución. La falta de coordinación, el desconocimiento de rutas confiables y la ausencia de mecanismos de verificación incrementan el riesgo y el costo del transporte.

## Problema para resolver

Diseñar y modelar un sistema que permita a estudiantes de una misma institución coordinar viajes compartidos de manera segura, controlada y organizada, priorizando:

- Verificación de pertenencia institucional (validación con correo personal)
- Coordinación por zona/horario
- Reglas mínimas de seguridad
- Calificación y comportamiento responsable dentro de la comunidad

## Objetivo general

Implementar de forma incremental una aplicacion que permita a estudiantes publicar y unirse a viajes compartidos, con controles de seguridad, reputacion y gobernanza institucional.

## Rol de este documento

Este archivo define la base funcional del producto y el problema que resuelve.

No debe usarse como fuente principal para saber:

- estado actual de implementacion
- ultimo bloque desarrollado
- siguiente bloque recomendado
- readiness de QA o release

Para eso, la referencia vigente debe ser:

- `Docs/10_HANDOFF_ESTADO_ACTUAL_Y_PENDIENTES.md`
- `Docs/08_RELEASE_READINESS_WEB.md`
- `Docs/09_CHECKLIST_QA_WEB_RELEASE.md`
- `Docs/07_ENTORNO_QA_DEPLOY.md`

## Alcance del sistema

### Roles

- **Estudiante (pasajero)**: busca viajes, solicita unirse, califica.
- **Estudiante conductor/a**: publica viajes, acepta/rechaza solicitudes, califica.
- **Administrador/a**: gestiona reportes, revisa usuarios y configura parámetros generales.

**Nota**: Un estudiante puede actuar como pasajero y conductor/a.

## Requerimientos funcionales mínimos

1. **RF1.** Registro e inicio de sesión de estudiantes usando correo institucional (verificación por código o enlace).
2. **RF2.** Gestión de perfil (nombre, carrera, foto opcional, número de contacto opcional, zona/barrio de referencia).
3. **RF3.** Publicación de viaje por parte del conductor/a indicando: origen aproximado (zona), destino (campus u otra zona), fecha/hora, cupos, notas/reglas.
4. **RF4.** Búsqueda y filtrado de viajes por zona, fecha/hora y disponibilidad.
5. **RF5.** Solicitud para unirse a un viaje (pasajero envía solicitud).
6. **RF6.** Gestión de solicitudes (conductor/a acepta o rechaza).
7. **RF7.** Confirmación de participación (la app registra quién quedó confirmado).
8. **RF8.** Calificación y reseña después del viaje (pasajero a conductor/a y conductor/a a pasajero).
9. **RF9.** Reglas mínimas de seguridad visibles antes de confirmar (ej.: puntualidad, respeto, no compartir datos, etc.).
10. **RF10.** Reportes: un estudiante puede reportar a otro por conducta indebida (motivo + evidencia opcional).
11. **RF11.** Administración básica: el administrador/a puede revisar reportes y aplicar acciones (advertir, suspender temporalmente).

## Requerimientos no funcionales (mínimos)

- **RNF1.** Seguridad: contraseñas cifradas, roles.
- **RNF2.** Usar ubicación y direcciones exactas.
- **RNF3.** Usabilidad: interfaz sencilla (plus para móvil).
- **RNF4.** Trazabilidad: registro de eventos clave (publicación, aceptación, cancelación, finalización).

## Reglas y restricciones

- La app funciona solo para estudiantes verificados (dominio institucional).
- La ubicación se maneja por coordenadas exactas.
- Los viajes son coordinados; la app **no** procesa pagos.
- El conductor/a controla aceptación de solicitudes.
- Las calificaciones afectan una reputación visible (promedio y cantidad de viajes).

## Extras

- Integración real con mapas en tiempo real (GPS tracking en vivo).
- Aplicación adaptada para móvil.
