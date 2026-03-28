import { AuditAction, AuditEntityType } from '../../domain/audit.types';

export const AUDIT_REPOSITORY = Symbol('AUDIT_REPOSITORY');

export type AuditJsonValue =
  | string
  | number
  | boolean
  | null
  | AuditJsonObject
  | AuditJsonValue[];

export type AuditJsonObject = {
  [key: string]: AuditJsonValue;
};

export type AuditEventRecord = {
  id: string;
  institutionId: string | null;
  institutionName: string | null;
  actorUserId: string | null;
  actorFullName: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string | null;
  metadata: AuditJsonObject | null;
  createdAt: Date;
};

export type CreateAuditEventInput = {
  institutionId?: string;
  actorUserId?: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  metadata?: AuditJsonObject;
};

export type AuditEventFilters = {
  institutionIds?: string[];
  actorUserId?: string;
  action?: AuditAction;
  entityType?: AuditEntityType;
  from?: Date;
  to?: Date;
  limit?: number;
};

export interface AuditRepository {
  createEvent(input: CreateAuditEventInput): Promise<void>;
  listEvents(filters: AuditEventFilters): Promise<AuditEventRecord[]>;
}
