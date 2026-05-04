import {
  AccountStatus,
  AdministrativeRiskState,
  DriverLicenseStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
  OperationalSanctionScope,
  OperationalSanctionStatus,
  OperationalSanctionTrigger,
  OperationalSanctionType,
  SANCTION_RECURRENCE_WINDOW_DAYS,
  TRUST_LOW_RATING_THRESHOLD,
  TRUST_MIN_COMPLETED_INTERACTIONS_FOR_SIGNAL,
  TRUST_MIN_RATINGS_FOR_SIGNAL,
  UserOnboardingRequirement,
  UserOnboardingStatus,
  VisibleReputationState,
} from '@saferidepro/shared-types';

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

export type UserProfile = {
  id: string;
  email: string;
  fullName: string;
  career?: string | null;
  phone?: string | null;
  referenceNeighborhood?: string | null;
  documentType: string;
  documentNumber: string;
  profilePhotoUrl?: string | null;
  globalRole: GlobalUserRole;
  accountStatus: AccountStatus;
  emailVerifiedAt: Date | null;
  termsAcceptedAt: Date | null;
  privacyAcceptedAt: Date | null;
  safetyRulesAcceptedAt: Date | null;
  onboardingCompletedAt: Date | null;
  onboardingStatus: UserOnboardingStatus;
  missingOnboardingRequirements: UserOnboardingRequirement[];
  requiresOnboarding: boolean;
  memberships: {
    id: string;
    institutionId: string;
    institutionName: string;
    institutionIsActive?: boolean;
    role: InstitutionMembershipRole;
    membershipStatus: MembershipStatus;
    studentCode: string;
    isDefault: boolean;
    driverVerificationStatus: DriverVerificationStatus;
    effectiveDriverVerificationStatus?: DriverVerificationStatus;
    licenseExpiresAt?: Date | null;
    licenseStatus?: DriverLicenseStatus;
    licenseExpiresInDays?: number | null;
  }[];
};

export type UpdateUserProfileInput = {
  fullName?: string;
  career?: string;
  phone?: string | null;
  referenceNeighborhood?: string;
  profilePhotoUrl?: string | null;
  termsAcceptedAt?: Date;
  privacyAcceptedAt?: Date;
  safetyRulesAcceptedAt?: Date;
  onboardingCompletedAt?: Date | null;
};

export type UserProfilePhotoRecord = {
  userId: string;
  profilePhotoUrl: string | null;
  profilePhotoStorageProvider: string | null;
  profilePhotoStorageKey: string | null;
};

export type TrustSummaryMetrics = {
  membershipId: string;
  averageRatingReceived: number | null;
  totalRatingsReceived: number;
  completedTripsAsDriver: number;
  completedTripsAsPassenger: number;
  lateDriverTripCancellations: number;
  latePassengerTripRequestCancellations: number;
  passengerNoShows: number;
  resolvedReportsReceived: number;
  resolvedLowSeverityReportsReceived: number;
  resolvedMediumSeverityReportsReceived: number;
  resolvedHighSeverityReportsReceived: number;
  cancellationPolicy: {
    lateWindowMinutes: number;
    lastComputedAt: Date;
  };
};

export type TrustSummary = TrustSummaryMetrics & {
  completedInteractions: number;
  hasEnoughRatingsSignal: boolean;
  hasLowRatingSignal: boolean;
  visibleReputationState: VisibleReputationState;
  administrativeRiskState: AdministrativeRiskState;
  riskSignals: string[];
  reputationPolicy: {
    lowRatingThreshold: number;
    minimumRatingsForSignal: number;
    minimumCompletedInteractionsForSignal: number;
    recurrenceWindowDays: number;
    lastComputedAt: Date;
  };
  sanctionPolicy?: {
    operationalWindowDays: number;
    reportsWindowDays: number;
    lastComputedAt: Date;
  };
  recentSanctionCount: number;
  recentBlockingSanctionCount: number;
  activeSanctions?: {
    id: string;
    type: OperationalSanctionType;
    scope: OperationalSanctionScope;
    status: OperationalSanctionStatus;
    trigger: OperationalSanctionTrigger;
    reason: string;
    startedAt: Date;
    endsAt: Date | null;
  }[];
};

export const DEFAULT_REPUTATION_POLICY = {
  lowRatingThreshold: TRUST_LOW_RATING_THRESHOLD,
  minimumRatingsForSignal: TRUST_MIN_RATINGS_FOR_SIGNAL,
  minimumCompletedInteractionsForSignal: TRUST_MIN_COMPLETED_INTERACTIONS_FOR_SIGNAL,
  recurrenceWindowDays: SANCTION_RECURRENCE_WINDOW_DAYS,
} as const;

export type AdminUserDirectoryRecord = {
  userId: string;
  email: string;
  fullName: string;
  profilePhotoUrl?: string | null;
  globalRole: GlobalUserRole;
  accountStatus: AccountStatus;
  createdAt: Date;
  emailVerifiedAt: Date | null;
  memberships: {
    id: string;
    institutionId: string;
    institutionName: string;
    role: InstitutionMembershipRole;
    membershipStatus: MembershipStatus;
    studentCode: string;
    isDefault: boolean;
    driverVerificationStatus: DriverVerificationStatus;
    effectiveDriverVerificationStatus?: DriverVerificationStatus;
    licenseExpiresAt?: Date | null;
    licenseStatus?: DriverLicenseStatus;
    licenseExpiresInDays?: number | null;
    activeSanctionsCount: number;
    activeBlockingSanctionsCount: number;
    resolvedReportsReceivedCount: number;
  }[];
};

export type ListAdminUserDirectoryInput = {
  institutionIds?: string[];
  query?: string;
  accountStatus?: AccountStatus;
  driverVerificationStatus?: DriverVerificationStatus;
  limit?: number;
};

export interface UsersRepository {
  findById(userId: string): Promise<UserProfile | null>;
  findProfilePhotoRecordById(userId: string): Promise<UserProfilePhotoRecord | null>;
  updateProfile(userId: string, input: UpdateUserProfileInput): Promise<UserProfile>;
  updateAccountStatus(userId: string, accountStatus: AccountStatus): Promise<UserProfile>;
  updateProfilePhoto(
    userId: string,
    input: {
      profilePhotoUrl: string | null;
      profilePhotoStorageProvider: string | null;
      profilePhotoStorageKey: string | null;
    },
  ): Promise<UserProfile>;
  getTrustSummary(membershipId: string): Promise<TrustSummaryMetrics>;
  listAdminUserDirectory(input: ListAdminUserDirectoryInput): Promise<AdminUserDirectoryRecord[]>;
}
