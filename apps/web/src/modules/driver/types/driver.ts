import {
  DriverLicenseStatus,
  DriverVerificationStatus,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

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
  effectiveDriverVerificationStatus?: DriverVerificationStatus;
  licenseExpiresAt?: string | null;
  licenseStatus?: DriverLicenseStatus;
  licenseExpiresInDays?: number | null;
};

export type DriverProfile = {
  membershipId: string;
  userId: string;
  userFullName: string;
  userEmail: string;
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
  licenseStatus?: DriverLicenseStatus;
  licenseExpiresInDays?: number | null;
  identityDocumentFileKey: string | null;
  licenseDocumentFileKey: string | null;
  hasRequiredDocuments?: boolean;
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

export type DriverDocumentType = 'identity' | 'license';

export type DriverDocumentUploadResponse = {
  message: string;
  documentType: DriverDocumentType;
  fileKey: string;
};

export type ReviewableDriverApplicationRecord = DriverProfile;

export type ReviewDriverApplicationInput = {
  decision: DriverVerificationStatus.Approved | DriverVerificationStatus.Rejected;
  reviewNotes?: string;
};

