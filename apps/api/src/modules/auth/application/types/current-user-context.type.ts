import {
  AccountStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

export type CurrentUserMembership = {
  id: string;
  institutionId: string;
  institutionName: string;
  role: InstitutionMembershipRole;
  membershipStatus: MembershipStatus;
  studentCode: string;
  isDefault: boolean;
  driverVerificationStatus: DriverVerificationStatus;
};

export type CurrentUserContext = {
  id: string;
  email: string;
  fullName: string;
  globalRole: GlobalUserRole;
  accountStatus: AccountStatus;
  memberships: CurrentUserMembership[];
};
