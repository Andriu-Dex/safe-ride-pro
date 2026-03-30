import {
  AccountStatus,
  DriverLicenseStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

export const AUTH_USER_REPOSITORY = Symbol('AUTH_USER_REPOSITORY');

export type ResolvedInstitution = {
  id: string;
  name: string;
  code: string;
};

export type AuthMembershipRecord = {
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

export type AuthUserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  globalRole: GlobalUserRole;
  accountStatus: AccountStatus;
  emailVerifiedAt: Date | null;
  memberships: AuthMembershipRecord[];
};

export type CreateUserWithMembershipInput = {
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string;
  documentType: string;
  documentNumber: string;
  studentCode: string;
  institutionId: string;
};

export type EmailVerificationRecord = {
  id: string;
  userId: string;
  expiresAt: Date;
  verifiedAt: Date | null;
};

export interface AuthUserRepository {
  findInstitutionByDomain(domain: string): Promise<ResolvedInstitution | null>;
  findUserByEmail(email: string): Promise<AuthUserRecord | null>;
  createUserWithMembership(input: CreateUserWithMembershipInput): Promise<AuthUserRecord>;
  createEmailVerificationCode(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findValidEmailVerification(tokenHash: string, now: Date): Promise<EmailVerificationRecord | null>;
  markEmailAsVerified(userId: string, tokenId: string, verifiedAt: Date): Promise<AuthUserRecord>;
}
