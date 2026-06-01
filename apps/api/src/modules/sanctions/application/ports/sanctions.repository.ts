import {
  MembershipStatus,
  OperationalSanctionAppealStatus,
  OperationalSanctionScope,
  OperationalSanctionStatus,
  OperationalSanctionTrigger,
  OperationalSanctionType,
  SANCTION_RECURRENCE_WINDOW_DAYS,
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

export type OperationalSanctionDetailRecord = OperationalSanctionRecord & {
  institutionId: string;
  institutionName: string;
  institutionIsActive: boolean;
  membershipStatus: MembershipStatus;
  membershipUserId: string;
  membershipUserFullName: string;
};

export type OperationalSanctionAppealRecord = {
  id: string;
  sanctionId: string;
  sanctionType: OperationalSanctionType;
  sanctionScope: OperationalSanctionScope;
  sanctionStatus: OperationalSanctionStatus;
  sanctionTrigger: OperationalSanctionTrigger;
  sanctionReason: string;
  sanctionStartedAt: Date;
  sanctionEndsAt: Date | null;
  institutionId: string;
  institutionName: string;
  institutionIsActive: boolean;
  membershipId: string;
  membershipStatus: MembershipStatus;
  affectedUserId: string;
  affectedFullName: string;
  requestedByUserId: string;
  requestedByFullName: string;
  status: OperationalSanctionAppealStatus;
  reason: string;
  reviewNote: string | null;
  reviewedAt: Date | null;
  reviewedByUserId: string | null;
  reviewedByFullName: string | null;
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

export type CreateOperationalSanctionAppealInput = {
  sanctionId: string;
  requestedByUserId: string;
  reason: string;
};

export type ReviewOperationalSanctionAppealInput = {
  appealId: string;
  reviewerUserId: string;
  status: OperationalSanctionAppealStatus;
  reviewNote: string;
};

export type ListReviewableOperationalSanctionAppealsInput = {
  institutionIds?: string[];
  status?: OperationalSanctionAppealStatus;
  limit?: number;
};

export type ListReviewableOperationalSanctionsInput = {
  institutionIds?: string[];
  userId?: string;
  limit?: number;
  asOf: Date;
};

export type RecentSanctionHistory = {
  recentSanctionCount: number;
  recentBlockingSanctionCount: number;
  recurrenceWindowDays: typeof SANCTION_RECURRENCE_WINDOW_DAYS;
};

export interface SanctionsRepository {
  findInstitutionIdByMembershipId(membershipId: string): Promise<string | null>;
  getRecentMetrics(membershipId: string, asOf: Date): Promise<OperationalSanctionMetrics>;
  getRecentSanctionHistory(membershipId: string, asOf: Date): Promise<RecentSanctionHistory>;
  countRecentBlockingSanctionsByScope(
    membershipId: string,
    scope: OperationalSanctionScope,
    asOf: Date,
  ): Promise<number>;
  listActiveSanctions(membershipId: string, asOf: Date): Promise<OperationalSanctionRecord[]>;
  findSanctionDetailById(sanctionId: string): Promise<OperationalSanctionDetailRecord | null>;
  listReviewableActiveSanctions(
    input: ListReviewableOperationalSanctionsInput,
  ): Promise<OperationalSanctionDetailRecord[]>;
  expireElapsedSanctions(membershipId: string, asOf: Date): Promise<OperationalSanctionRecord[]>;
  expireSanction(sanctionId: string, asOf: Date): Promise<OperationalSanctionRecord>;
  createOperationalSanction(
    input: CreateOperationalSanctionInput,
  ): Promise<OperationalSanctionRecord>;
  findAppealBySanctionId(sanctionId: string): Promise<OperationalSanctionAppealRecord | null>;
  findAppealById(appealId: string): Promise<OperationalSanctionAppealRecord | null>;
  createOperationalSanctionAppeal(
    input: CreateOperationalSanctionAppealInput,
  ): Promise<OperationalSanctionAppealRecord>;
  listAppealsByRequestedByUserId(
    userId: string,
  ): Promise<OperationalSanctionAppealRecord[]>;
  listReviewableOperationalSanctionAppeals(
    input: ListReviewableOperationalSanctionAppealsInput,
  ): Promise<OperationalSanctionAppealRecord[]>;
  reviewOperationalSanctionAppeal(
    input: ReviewOperationalSanctionAppealInput,
  ): Promise<OperationalSanctionAppealRecord>;
}
