import {
  DriverLicenseStatus,
  DriverVerificationStatus,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

export const DRIVERS_REPOSITORY = Symbol('DRIVERS_REPOSITORY');

export enum DriverDocumentType {
  Identity = 'identity',
  License = 'license',
}

export type DriverMembershipRecord = {
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
  licenseExpiresAt?: Date | null;
  licenseStatus?: DriverLicenseStatus;
  licenseExpiresInDays?: number | null;
};

export type DriverProfileRecord = {
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
  licenseExpiresAt: Date;
  licenseStatus?: DriverLicenseStatus;
  licenseExpiresInDays?: number | null;
  identityDocumentFileKey: string | null;
  licenseDocumentFileKey: string | null;
  hasRequiredDocuments?: boolean;
  reviewNotes: string | null;
  reviewedAt: Date | null;
  reviewedByUserId: string | null;
  submittedAt: Date;
};

export type ListReviewableDriverApplicationsFilters = {
  institutionIds?: string[];
  status?: DriverVerificationStatus;
  limit?: number;
};

export type SubmitDriverApplicationInput = {
  membershipId: string;
  licenseTypeId: string;
  licenseNumber: string;
  licenseExpiresAt: Date;
  identityDocumentFileKey?: string;
  licenseDocumentFileKey?: string;
};

export type ReviewDriverApplicationInput = {
  membershipId: string;
  reviewerUserId: string;
  decision: DriverVerificationStatus.Approved | DriverVerificationStatus.Rejected;
  reviewNotes?: string;
};

export interface DriversRepository {
  findDefaultMembershipByUserId(userId: string): Promise<DriverMembershipRecord | null>;
  findMembershipById(membershipId: string): Promise<DriverMembershipRecord | null>;
  findDriverProfileByMembershipId(membershipId: string): Promise<DriverProfileRecord | null>;
  findDriverProfileByLicenseNumber(licenseNumber: string): Promise<DriverProfileRecord | null>;
  listReviewableDriverApplications(
    filters: ListReviewableDriverApplicationsFilters,
  ): Promise<DriverProfileRecord[]>;
  submitDriverApplication(input: SubmitDriverApplicationInput): Promise<DriverProfileRecord>;
  reviewDriverApplication(input: ReviewDriverApplicationInput): Promise<DriverProfileRecord>;
}
