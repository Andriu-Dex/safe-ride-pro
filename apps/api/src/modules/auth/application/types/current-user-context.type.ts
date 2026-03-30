import {
  AccountStatus,
  DriverLicenseStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

export type CurrentUserMembership = {
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
};

export type CurrentUserContext = {
  id: string;
  email: string;
  fullName: string;
  globalRole: GlobalUserRole;
  accountStatus: AccountStatus;
  memberships: CurrentUserMembership[];
};
