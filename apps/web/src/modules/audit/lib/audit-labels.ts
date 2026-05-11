import type { AuditAction, AuditEntityType } from '../types/audit';

export function getAuditActionLabel(action: AuditAction): string {
  switch (action) {
    case 'AUTH_REGISTERED':
      return 'Registro de cuenta';
    case 'AUTH_EMAIL_VERIFIED':
      return 'Correo verificado';
    case 'AUTH_VERIFICATION_CODE_RESENT':
      return 'Codigo de verificacion reenviado';
    case 'AUTH_LOGIN_SUCCEEDED':
      return 'Inicio de sesion exitoso';
    case 'AUTH_LOGIN_FAILED':
      return 'Intento fallido de inicio';
    case 'AUTH_PASSWORD_RESET_REQUESTED':
      return 'Recuperacion de contrasena solicitada';
    case 'AUTH_PASSWORD_RESET_COMPLETED':
      return 'Contrasena restablecida';
    case 'AUTH_SESSION_REFRESHED':
      return 'Sesion renovada';
    case 'AUTH_LOGGED_OUT':
      return 'Cierre de sesion';
    case 'DRIVER_APPLICATION_SUBMITTED':
      return 'Solicitud de conductor enviada';
    case 'DRIVER_APPLICATION_APPROVED':
      return 'Solicitud de conductor aprobada';
    case 'DRIVER_APPLICATION_REJECTED':
      return 'Solicitud de conductor rechazada';
    case 'TRIP_CREATED':
      return 'Viaje creado';
    case 'TRIP_PUBLISHED':
      return 'Viaje publicado';
    case 'TRIP_STARTED':
      return 'Viaje iniciado';
    case 'TRIP_PASSENGER_BOARDED':
      return 'Pasajero marcado como abordado';
    case 'TRIP_PASSENGER_DROPPED_OFF':
      return 'Pasajero marcado como finalizado';
    case 'TRIP_COMPLETED':
      return 'Viaje completado';
    case 'TRIP_CANCELLED':
      return 'Viaje cancelado';
    case 'TRIP_UPDATED':
      return 'Viaje actualizado';
    case 'REPORT_CREATED':
      return 'Reporte creado';
    case 'REPORT_REVIEWED':
      return 'Reporte revisado';
    case 'SANCTION_APPLIED':
      return 'Sancion aplicada';
    case 'SANCTION_EXPIRED':
      return 'Sancion vencida';
    case 'SANCTION_APPEAL_SUBMITTED':
      return 'Apelacion de sancion enviada';
    case 'SANCTION_APPEAL_APPROVED':
      return 'Apelacion de sancion aprobada';
    case 'SANCTION_APPEAL_REJECTED':
      return 'Apelacion de sancion rechazada';
    case 'SANCTION_LIFTED_MANUALLY':
      return 'Sancion levantada manualmente';
    case 'INSTITUTION_SETTINGS_UPDATED':
      return 'Configuracion institucional actualizada';
    default:
      return action;
  }
}

export function getAuditEntityTypeLabel(entityType: AuditEntityType): string {
  switch (entityType) {
    case 'USER':
      return 'Usuario';
    case 'USER_MEMBERSHIP':
      return 'Membresia';
    case 'DRIVER_PROFILE':
      return 'Perfil de conductor';
    case 'TRIP':
      return 'Viaje';
    case 'INSTITUTION':
      return 'Institucion';
    case 'REPORT':
      return 'Reporte';
    case 'OPERATIONAL_SANCTION':
      return 'Sancion';
    case 'SANCTION_APPEAL':
      return 'Apelacion';
    case 'AUTH_SESSION':
      return 'Sesion';
    default:
      return entityType;
  }
}
