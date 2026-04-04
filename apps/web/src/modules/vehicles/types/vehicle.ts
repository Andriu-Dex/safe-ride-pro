import {
  DriverLicenseStatus,
  DriverVerificationStatus,
  LuggagePolicy,
  MembershipStatus,
  VehicleType,
} from '@saferidepro/shared-types';

export type VehicleMembership = {
  id: string;
  institutionId: string;
  institutionName: string;
  membershipStatus: MembershipStatus;
  driverVerificationStatus: DriverVerificationStatus;
  effectiveDriverVerificationStatus?: DriverVerificationStatus;
  licenseExpiresAt?: string | null;
  licenseStatus?: DriverLicenseStatus;
  licenseExpiresInDays?: number | null;
};

export type VehicleRecord = {
  id: string;
  membershipId: string;
  institutionId: string;
  institutionName: string;
  vehicleType: VehicleType;
  brandId: string | null;
  brandName: string | null;
  modelId: string | null;
  modelName: string | null;
  customBrandName: string | null;
  customModelName: string | null;
  year: number;
  color: string;
  plate: string;
  seatCount: number;
  luggagePolicy: LuggagePolicy;
  registrationDocumentFileKey: string | null;
  isActive: boolean;
  operationalTripCount: number;
  createdAt: string;
};

export type VehicleOverview = {
  membership: VehicleMembership | null;
  vehicles: VehicleRecord[];
};

export type VehicleBrandCatalogItem = {
  id: string;
  name: string;
};

export type VehicleModelCatalogItem = {
  id: string;
  brandId: string;
  brandName: string;
  name: string;
  vehicleType: VehicleType;
  isActive: boolean;
};

export type RegisterVehicleInput = {
  vehicleType: VehicleType;
  brandId?: string;
  modelId?: string;
  customBrandName?: string;
  customModelName?: string;
  year: number;
  color: string;
  plate: string;
  seatCount: number;
  luggagePolicy: LuggagePolicy;
  registrationDocumentFileKey?: string;
};

export type UpdateVehicleInput = RegisterVehicleInput;

export type VehicleDocumentUploadResponse = {
  message: string;
  fileKey: string;
};

