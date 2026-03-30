import {
  OperationalSanctionScope,
  OperationalSanctionStatus,
  OperationalSanctionTrigger,
  OperationalSanctionType,
  type OperationalSanctionMetrics,
} from '@saferidepro/shared-types';

export const SANCTIONS_REPOSITORY = Symbol('SANCTIONS_REPOSITORY');

export type OperationalSanctionRecord = {
  id: string;
  membershipId: string;
  type: OperationalSanctionType;
  scope: OperationalSanctionScope;
  status: OperationalSanctionStatus;
  trigger: OperationalSanctionTrigger;
  reason: string;
  isAutomatic: boolean;
  startedAt: Date;
  endsAt: Date | null;
  expiredAt: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateOperationalSanctionInput = {
  membershipId: string;
  type: OperationalSanctionType;
  scope: OperationalSanctionScope;
  trigger: OperationalSanctionTrigger;
  reason: string;
  isAutomatic: boolean;
  startedAt: Date;
  endsAt: Date | null;
  metadata?: Record<string, unknown>;
};

export interface SanctionsRepository {
  findInstitutionIdByMembershipId(membershipId: string): Promise<string | null>;
  getRecentMetrics(membershipId: string, asOf: Date): Promise<OperationalSanctionMetrics>;
  listActiveSanctions(membershipId: string, asOf: Date): Promise<OperationalSanctionRecord[]>;
  expireElapsedSanctions(membershipId: string, asOf: Date): Promise<OperationalSanctionRecord[]>;
  expireSanction(sanctionId: string, asOf: Date): Promise<OperationalSanctionRecord>;
  createOperationalSanction(
    input: CreateOperationalSanctionInput,
  ): Promise<OperationalSanctionRecord>;
}
