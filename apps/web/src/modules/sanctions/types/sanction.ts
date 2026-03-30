import type {
  MembershipStatus,
  OperationalSanctionAppealStatus,
  OperationalSanctionScope,
  OperationalSanctionStatus,
  OperationalSanctionTrigger,
  OperationalSanctionType,
} from '@saferidepro/shared-types';

export type OperationalSanctionAppealRecord = {
  id: string;
  sanctionId: string;
  sanctionType: OperationalSanctionType;
  sanctionScope: OperationalSanctionScope;
  sanctionStatus: OperationalSanctionStatus;
  sanctionTrigger: OperationalSanctionTrigger;
  sanctionReason: string;
  sanctionStartedAt: string;
  sanctionEndsAt: string | null;
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
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  reviewedByFullName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReviewableOperationalSanctionRecord = {
  id: string;
  membershipId: string;
  institutionId: string;
  institutionName: string;
  institutionIsActive: boolean;
  membershipStatus: MembershipStatus;
  membershipUserId: string;
  membershipUserFullName: string;
  type: OperationalSanctionType;
  scope: OperationalSanctionScope;
  status: OperationalSanctionStatus;
  trigger: OperationalSanctionTrigger;
  reason: string;
  isAutomatic: boolean;
  startedAt: string;
  endsAt: string | null;
  expiredAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type SubmitSanctionAppealInput = {
  reason: string;
};

export type ReviewSanctionAppealInput = {
  status: OperationalSanctionAppealStatus;
  reviewNote?: string;
};

export type LiftOperationalSanctionInput = {
  reviewNote?: string;
};
