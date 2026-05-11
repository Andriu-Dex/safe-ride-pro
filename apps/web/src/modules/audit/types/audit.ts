export const AUDIT_ACTIONS = [
  'AUTH_REGISTERED',
  'AUTH_EMAIL_VERIFIED',
  'AUTH_VERIFICATION_CODE_RESENT',
  'AUTH_LOGIN_SUCCEEDED',
  'AUTH_LOGIN_FAILED',
  'AUTH_PASSWORD_RESET_REQUESTED',
  'AUTH_PASSWORD_RESET_COMPLETED',
  'AUTH_SESSION_REFRESHED',
  'AUTH_LOGGED_OUT',
  'DRIVER_APPLICATION_SUBMITTED',
  'DRIVER_APPLICATION_APPROVED',
  'DRIVER_APPLICATION_REJECTED',
  'TRIP_CREATED',
  'TRIP_PUBLISHED',
  'TRIP_STARTED',
  'TRIP_PASSENGER_BOARDED',
  'TRIP_PASSENGER_DROPPED_OFF',
  'TRIP_COMPLETED',
  'TRIP_CANCELLED',
  'TRIP_UPDATED',
  'REPORT_CREATED',
  'REPORT_REVIEWED',
  'SANCTION_APPLIED',
  'SANCTION_EXPIRED',
  'SANCTION_APPEAL_SUBMITTED',
  'SANCTION_APPEAL_APPROVED',
  'SANCTION_APPEAL_REJECTED',
  'SANCTION_LIFTED_MANUALLY',
  'INSTITUTION_SETTINGS_UPDATED',
] as const;

export const AUDIT_ENTITY_TYPES = [
  'USER',
  'USER_MEMBERSHIP',
  'DRIVER_PROFILE',
  'TRIP',
  'INSTITUTION',
  'REPORT',
  'OPERATIONAL_SANCTION',
  'SANCTION_APPEAL',
  'AUTH_SESSION',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export type AuditEventRecord = {
  id: string;
  institutionId: string | null;
  institutionName: string | null;
  actorUserId: string | null;
  actorFullName: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type AuditFilters = {
  institutionId?: string;
  action?: AuditAction;
  entityType?: AuditEntityType;
  from?: string;
  to?: string;
  limit?: string;
};
