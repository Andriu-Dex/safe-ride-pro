import {
  AccountStatus,
  DriverLicenseStatus,
  DriverVerificationStatus,
  DocumentType,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

export type AuthMembership = {
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
  licenseExpiresAt?: string | null;
  licenseStatus?: DriverLicenseStatus;
  licenseExpiresInDays?: number | null;
};

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  documentType: DocumentType;
  documentNumber: string;
  profilePhotoUrl: string | null;
  globalRole: GlobalUserRole;
  accountStatus: AccountStatus;
  emailVerifiedAt: string | null;
  memberships: AuthMembership[];
};

export type AuthSession = {
  accessToken: string;
  user: AuthUser;
};

export type LoginInput = {
  email: string;
  password: string;
};

