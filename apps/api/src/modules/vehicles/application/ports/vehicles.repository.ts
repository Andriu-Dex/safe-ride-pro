import {
  DriverLicenseStatus,
  DriverVerificationStatus,
  LuggagePolicy,
  MembershipStatus,
  VehicleType,
} from '@saferidepro/shared-types';

export const VEHICLES_REPOSITORY = Symbol('VEHICLES_REPOSITORY');

export type VehicleMembershipRecord = {
  id: string;
  institutionId: string;
  institutionName: string;
  membershipStatus: MembershipStatus;
  driverVerificationStatus: DriverVerificationStatus;
  effectiveDriverVerificationStatus?: DriverVerificationStatus;
  licenseExpiresAt?: Date | null;
  licenseStatus?: DriverLicenseStatus;
  licenseExpiresInDays?: number | null;
};

export type LicenseTypeCatalogItem = {
  id: string;
  code: string;
  name: string;
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
  createdAt: Date;
};

export type CreateVehicleInput = {
  membershipId: string;
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

export type UpdateVehicleInput = CreateVehicleInput & {
  vehicleId: string;
};

export interface VehiclesRepository {
  findDefaultMembershipByUserId(userId: string): Promise<VehicleMembershipRecord | null>;
  listLicenseTypes(): Promise<LicenseTypeCatalogItem[]>;
  listVehicleBrands(filters?: {
    vehicleType?: VehicleType;
  }): Promise<VehicleBrandCatalogItem[]>;
  listVehicleModels(filters?: {
    brandId?: string;
    vehicleType?: VehicleType;
  }): Promise<VehicleModelCatalogItem[]>;
  findVehicleBrandById(brandId: string): Promise<VehicleBrandCatalogItem | null>;
  findVehicleModelById(modelId: string): Promise<VehicleModelCatalogItem | null>;
  findVehicleByPlate(plate: string): Promise<VehicleRecord | null>;
  findVehicleByIdForMembership(
    membershipId: string,
    vehicleId: string,
  ): Promise<VehicleRecord | null>;
  findVehiclesByMembershipId(membershipId: string): Promise<VehicleRecord[]>;
  createVehicle(input: CreateVehicleInput): Promise<VehicleRecord>;
  updateVehicle(input: UpdateVehicleInput): Promise<VehicleRecord>;
  updateVehicleStatus(
    vehicleId: string,
    isActive: boolean,
  ): Promise<VehicleRecord>;
}
