import {
  AccountStatus,
  DriverLicenseStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

export type AdminDirectoryMembershipRecord = {
  id: string;
  institutionId: string;
  institutionName: string;
  role: InstitutionMembershipRole;
  membershipStatus: MembershipStatus;
  studentCode: string;
  isDefault: boolean;
  driverVerificationStatus: DriverVerificationStatus;
  effectiveDriverVerificationStatus?: DriverVerificationStatus;
  licenseExpiresAt?: string | null;
  licenseStatus?: DriverLicenseStatus;
  licenseExpiresInDays?: number | null;
  activeSanctionsCount: number;
  activeBlockingSanctionsCount: number;
  resolvedReportsReceivedCount: number;
};

export type AdminUserDirectoryRecord = {
  userId: string;
  email: string;
  fullName: string;
  profilePhotoUrl?: string | null;
  globalRole: GlobalUserRole;
  accountStatus: AccountStatus;
  createdAt: string;
  emailVerifiedAt: string | null;
  memberships: AdminDirectoryMembershipRecord[];
};
