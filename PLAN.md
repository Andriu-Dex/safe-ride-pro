# Plan Final: SafeRidePro UX Profesional, Roles, Pagos y Notificaciones

**Resumen**
Reconstruir el frontend como una experiencia final para usuarios reales: menos técnica, más directa, profesional y centrada en acciones. Además, completar la separación usuario/conductor, pagos en efectivo y PayPal, notificaciones, calificaciones y sanciones.

Hallazgo inicial: los `.env` principales no tienen claves duplicadas y los `.env.example` están alineados con sus respectivos `.env`. Se mantendrán como fuente canónica y solo se limpiarán nombres/variables legacy si aparecen durante la implementación.

**Cambios Clave**
- Crear un sistema visual consistente con CSS Modules + Tailwind: componentes reutilizables para modales, drawers, cards, estados vacíos, botones, badges, tabs, acordeones, confirmaciones y layouts.
- Reemplazar los textos técnicos o explicativos por mensajes cortos orientados a acción. La información secundaria irá en secciones desplegables como “Ver detalles”.
- Centralizar los toast en un proveedor global para que siempre aparezcan sobre toda la app y sobrevivan cambios de pantalla. Eliminar mensajes de éxito/error renderizados directamente en las vistas.
- Corregir textos mezclados o dañados por encoding, manteniendo código en inglés e interfaces en español.

**Roles y Navegación**
- Separar navegación por tipo de usuario.
- Usuario común verá: `Inicio`, `Buscar viajes`, `Mis viajes`, `Pagos`, `Confianza` y `Perfil`.
- Usuario sin aprobación de conductor verá una entrada clara: `Ser conductor`, sin acceso a vistas operativas de conductor.
- Conductor aprobado verá además: `Conductor`, `Nuevo viaje`, `Vehículos`, `Solicitudes`, `Cobros` y herramientas operativas.
- Administradores mantendrán acceso separado a auditoría/revisión.
- La validación será doble: ocultar opciones en el sidebar y proteger rutas para impedir acceso manual por URL.

**Pagos, Calificaciones y Sanciones**
- Extender pagos para soportar `PAYPAL` y `CASH`.
- PayPal: al solicitar el viaje, el usuario debe pagar en ese momento. La solicitud no será accionable para el conductor hasta que el pago esté confirmado.
- Efectivo: el viaje puede solicitarse sin pago previo; al finalizar, el conductor podrá marcar “Pago recibido” o reportar “No pagó / hubo novedad”.
- Los reportes de efectivo crearán incidentes dentro del flujo de confianza y podrán disparar sanciones al usuario.
- Al completar un viaje, el usuario recibirá una notificación para calificar al conductor con puntuación y comentario.
- Las calificaciones bajas, cancelaciones graves, no-show o reportes generarán eventos para el sistema de sanciones existente.

**Notificaciones**
- Implementar campana global con contador de no leídas.
- Crear notificaciones persistentes para usuario y conductor: solicitud enviada, pago confirmado, solicitud recibida, viaje aceptado, viaje cancelado, pago en efectivo pendiente, calificación pendiente, sanción/reporte y cambios administrativos.
- Usar realtime existente para mostrar nuevas notificaciones sin recargar.
- Cada notificación tendrá acción directa cuando aplique, por ejemplo “Ver viaje”, “Pagar ahora”, “Confirmar efectivo” o “Calificar”.

**Rediseño Frontend**
- Rehacer las vistas con una arquitectura más limpia y menos amontonada.
- `Inicio`: resumen útil y acciones rápidas, no dashboard disfrazado.
- `Dashboard`: reservarlo para reportes/lectura ejecutiva, visible solo donde tenga sentido.
- `Conductor`: enfocada en estado de solicitud o acciones operativas reales; detalles técnicos colapsados.
- `Vehículos`: gestión limpia de vehículo activo, documentos y estados.
- `Viajes`: separar buscar, solicitudes, viajes activos e historial sin mezclar todo.
- `Nuevo viaje`: flujo guiado y visual para publicar viaje, solo para conductor aprobado.
- `Confianza`: reportes, sanciones, apelaciones y calificaciones pendientes de forma clara.
- `Perfil`: mantener edición en modal, foto con vista previa elegante y datos secundarios mejor organizados.

**Cambios de API / Tipos**
- Agregar `CASH` a `PaymentProvider` en Prisma y shared-types.
- Agregar método de pago a la creación de solicitud de viaje.
- Crear endpoints para confirmar pago en efectivo y reportar novedad de efectivo.
- Crear módulo/endpoints de notificaciones: listar, marcar como leída, marcar todas, contador.
- Emitir eventos realtime para nuevas notificaciones.
- Ajustar consultas de solicitudes para que PayPal no aparezca al conductor hasta estar pagado.

**Pruebas**
- Validar `.env` y configuración con typecheck/build.
- Pruebas de integración API para solicitud con PayPal, solicitud con efectivo, confirmación de efectivo, reporte de no pago, notificaciones y control de acceso por rol.
- Pruebas frontend para navegación usuario/conductor/admin, toast global, campana, modales y flujos principales.
- E2E smoke: registro, verificación, perfil, solicitud de conductor, aprobación, publicar viaje, solicitar viaje con efectivo, solicitar viaje con PayPal, calificar y generar reporte.

**Supuestos**
- No se agregará email/push externo para notificaciones en esta versión; la campana será persistente dentro de la app y realtime.
- Se añadirá una librería de iconos profesional al frontend si no existe una instalada actualmente.
- PayPal seguirá usando la configuración existente del backend.
- La app final priorizará claridad y acciones sobre métricas visibles permanentes.
