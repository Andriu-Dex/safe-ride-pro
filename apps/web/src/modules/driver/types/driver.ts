import { DriverVerificationStatus, InstitutionMembershipRole, MembershipStatus } from '@saferidepro/shared-types';

export type DriverMembership = {
  id: string;
  userId: string;
  institutionId: string;
  institutionName: string;
  role: InstitutionMembershipRole;
  membershipStatus: MembershipStatus;
  studentCode: string;
  isDefault: boolean;
  driverVerificationStatus: DriverVerificationStatus;
};

export type DriverProfile = {
  membershipId: string;
  institutionId: string;
  institutionName: string;
  driverVerificationStatus: DriverVerificationStatus;
  licenseType: {
    id: string;
    code: string;
    name: string;
  };
  licenseNumber: string;
  licenseExpiresAt: string;
  identityDocumentFileKey: string | null;
  licenseDocumentFileKey: string | null;
  reviewNotes: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  submittedAt: string;
};

export type DriverOverview = {
  membership: DriverMembership | null;
  driverProfile: DriverProfile | null;
};

export type LicenseTypeCatalogItem = {
  id: string;
  code: string;
  name: string;
};

export type SubmitDriverApplicationInput = {
  licenseTypeId: string;
  licenseNumber: string;
  licenseExpiresAt: string;
  identityDocumentFileKey?: string;
  licenseDocumentFileKey?: string;
};

