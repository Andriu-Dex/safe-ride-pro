import {
  AccountStatus,
  DriverLicenseStatus,
  DriverVerificationStatus,
  DocumentType,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
  UserOnboardingRequirement,
  UserOnboardingStatus,
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
  career: string | null;
  phone: string | null;
  referenceNeighborhood: string | null;
  documentType: DocumentType;
  documentNumber: string;
  profilePhotoUrl: string | null;
  globalRole: GlobalUserRole;
  accountStatus: AccountStatus;
  emailVerifiedAt: string | null;
  termsAcceptedAt: string | null;
  privacyAcceptedAt: string | null;
  safetyRulesAcceptedAt: string | null;
  onboardingCompletedAt: string | null;
  onboardingStatus: UserOnboardingStatus;
  missingOnboardingRequirements: UserOnboardingRequirement[];
  requiresOnboarding: boolean;
  memberships: AuthMembership[];
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  documentType: DocumentType;
  documentNumber: string;
};

