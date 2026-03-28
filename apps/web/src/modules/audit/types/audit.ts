export const AUDIT_ACTIONS = [
  'AUTH_REGISTERED',
  'AUTH_EMAIL_VERIFIED',
  'AUTH_LOGIN_SUCCEEDED',
  'AUTH_LOGIN_FAILED',
  'DRIVER_APPLICATION_SUBMITTED',
  'DRIVER_APPLICATION_APPROVED',
  'DRIVER_APPLICATION_REJECTED',
  'TRIP_CREATED',
  'TRIP_PUBLISHED',
  'TRIP_STARTED',
  'TRIP_COMPLETED',
  'TRIP_CANCELLED',
  'REPORT_CREATED',
  'REPORT_REVIEWED',
] as const;

export const AUDIT_ENTITY_TYPES = [
  'USER',
  'DRIVER_PROFILE',
  'TRIP',
  'REPORT',
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
