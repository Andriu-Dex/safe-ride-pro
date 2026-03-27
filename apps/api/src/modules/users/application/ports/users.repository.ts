import {
  AccountStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
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
    role: InstitutionMembershipRole;
    membershipStatus: MembershipStatus;
    studentCode: string;
    isDefault: boolean;
    driverVerificationStatus: DriverVerificationStatus;
  }[];
};

export type UpdateUserProfileInput = {
  fullName?: string;
  phone?: string;
  profilePhotoUrl?: string;
};

export interface UsersRepository {
  findById(userId: string): Promise<UserProfile | null>;
  updateProfile(userId: string, input: UpdateUserProfileInput): Promise<UserProfile>;
}
