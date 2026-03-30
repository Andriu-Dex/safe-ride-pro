import {
  AccountStatus,
  DriverLicenseStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
  OperationalSanctionScope,
  OperationalSanctionStatus,
  OperationalSanctionTrigger,
  OperationalSanctionType,
} from '@saferidepro/shared-types';

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

export type UserProfile = {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  documentType: string;
  documentNumber: string;
  profilePhotoUrl?: string | null;
  globalRole: GlobalUserRole;
  accountStatus: AccountStatus;
  emailVerifiedAt: Date | null;
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
  phone?: string;
  profilePhotoUrl?: string;
};

export type TrustSummary = {
  membershipId: string;
  averageRatingReceived: number | null;
  totalRatingsReceived: number;
  completedTripsAsDriver: number;
  completedTripsAsPassenger: number;
  lateDriverTripCancellations: number;
  latePassengerTripRequestCancellations: number;
  passengerNoShows: number;
  resolvedReportsReceived: number;
  cancellationPolicy: {
    lateWindowMinutes: number;
    lastComputedAt: Date;
  };
  sanctionPolicy?: {
    operationalWindowDays: number;
    reportsWindowDays: number;
    lastComputedAt: Date;
  };
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

export interface UsersRepository {
  findById(userId: string): Promise<UserProfile | null>;
  updateProfile(userId: string, input: UpdateUserProfileInput): Promise<UserProfile>;
  getTrustSummary(membershipId: string): Promise<TrustSummary>;
}
