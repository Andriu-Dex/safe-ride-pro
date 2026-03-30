import { Injectable } from '@nestjs/common';
import {
  DriverLicenseStatus,
  DriverVerificationStatus,
  getDaysUntilDriverLicenseExpiration,
  getDriverLicenseStatus,
  getEffectiveDriverVerificationStatus,
  LuggagePolicy,
  MembershipStatus,
  VehicleType,
} from '@saferidepro/shared-types';

import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import {
  CreateVehicleInput,
  LicenseTypeCatalogItem,
  VehicleBrandCatalogItem,
  VehicleMembershipRecord,
  VehicleModelCatalogItem,
  VehicleRecord,
  VehiclesRepository,
} from '../../application/ports/vehicles.repository';

@Injectable()
export class PrismaVehiclesRepository implements VehiclesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findDefaultMembershipByUserId(userId: string): Promise<VehicleMembershipRecord | null> {
    const membership = await this.prisma.userInstitutionMembership.findFirst({
      where: {
        userId,
        membershipStatus: 'ACTIVE',
        institution: {
          isActive: true,
        },
      },
      include: {
        institution: true,
        driverProfile: {
          select: {
            licenseExpiresAt: true,
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { joinedAt: 'asc' }],
    });

    if (!membership) {
      return null;
    }

    return {
      id: membership.id,
      institutionId: membership.institutionId,
      institutionName: membership.institution.name,
      membershipStatus: membership.membershipStatus as MembershipStatus,
      driverVerificationStatus:
        membership.driverVerificationStatus as DriverVerificationStatus,
      effectiveDriverVerificationStatus: getEffectiveDriverVerificationStatus(
        membership.driverVerificationStatus as DriverVerificationStatus,
        membership.driverProfile?.licenseExpiresAt ?? null,
      ) as DriverVerificationStatus,
      licenseExpiresAt: membership.driverProfile?.licenseExpiresAt ?? null,
      licenseStatus: getDriverLicenseStatus(membership.driverProfile?.licenseExpiresAt ?? null),
      licenseExpiresInDays: getDaysUntilDriverLicenseExpiration(
        membership.driverProfile?.licenseExpiresAt ?? null,
      ),
    };
  }

  async listLicenseTypes(): Promise<LicenseTypeCatalogItem[]> {
    const licenseTypes = await this.prisma.licenseType.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });

    return licenseTypes.map((licenseType) => ({
      id: licenseType.id,
      code: licenseType.code,
      name: licenseType.name,
    }));
  }

  async listVehicleBrands(): Promise<VehicleBrandCatalogItem[]> {
    const brands = await this.prisma.vehicleBrand.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return brands.map((brand) => ({
      id: brand.id,
      name: brand.name,
    }));
  }

  async listVehicleModels(filters?: {
    brandId?: string;
    vehicleType?: VehicleType;
  }): Promise<VehicleModelCatalogItem[]> {
    const models = await this.prisma.vehicleModel.findMany({
      where: {
        isActive: true,
        brandId: filters?.brandId,
        vehicleType: filters?.vehicleType,
      },
      include: {
        brand: true,
      },
      orderBy: [{ brandId: 'asc' }, { name: 'asc' }],
    });

    return models.map((model) => ({
      id: model.id,
      brandId: model.brandId,
      brandName: model.brand.name,
      name: model.name,
      vehicleType: model.vehicleType as VehicleType,
      isActive: model.isActive,
    }));
  }

  async findVehicleBrandById(brandId: string): Promise<VehicleBrandCatalogItem | null> {
    const brand = await this.prisma.vehicleBrand.findFirst({
      where: {
        id: brandId,
        isActive: true,
      },
    });

    return brand
      ? {
          id: brand.id,
          name: brand.name,
        }
      : null;
  }

  async findVehicleModelById(modelId: string): Promise<VehicleModelCatalogItem | null> {
    const model = await this.prisma.vehicleModel.findFirst({
      where: {
        id: modelId,
        isActive: true,
      },
      include: {
        brand: true,
      },
    });

    return model
      ? {
          id: model.id,
          brandId: model.brandId,
          brandName: model.brand.name,
          name: model.name,
          vehicleType: model.vehicleType as VehicleType,
          isActive: model.isActive,
        }
      : null;
  }

  async findVehicleByPlate(plate: string): Promise<VehicleRecord | null> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { plate },
      include: {
        membership: {
          include: {
            institution: true,
          },
        },
        brand: true,
        model: true,
      },
    });

    return vehicle ? this.mapVehicle(vehicle) : null;
  }

  async findVehiclesByMembershipId(membershipId: string): Promise<VehicleRecord[]> {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { membershipId },
      include: {
        membership: {
          include: {
            institution: true,
          },
        },
        brand: true,
        model: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return vehicles.map((vehicle) => this.mapVehicle(vehicle));
  }

  async createVehicle(input: CreateVehicleInput): Promise<VehicleRecord> {
    const vehicle = await this.prisma.vehicle.create({
      data: {
        membershipId: input.membershipId,
        vehicleType: input.vehicleType,
        brandId: input.brandId,
        modelId: input.modelId,
        customBrandName: input.customBrandName,
        customModelName: input.customModelName,
        year: input.year,
        color: input.color,
        plate: input.plate,
        seatCount: input.seatCount,
        luggagePolicy: input.luggagePolicy,
        registrationDocumentFileKey: input.registrationDocumentFileKey,
      },
      include: {
        membership: {
          include: {
            institution: true,
          },
        },
        brand: true,
        model: true,
      },
    });

    return this.mapVehicle(vehicle);
  }

  private mapVehicle(vehicle: {
    id: string;
    membershipId: string;
    vehicleType: string;
    brandId: string | null;
    modelId: string | null;
    customBrandName: string | null;
    customModelName: string | null;
    year: number;
    color: string;
    plate: string;
    seatCount: number;
    luggagePolicy: string;
    registrationDocumentFileKey: string | null;
    isActive: boolean;
    createdAt: Date;
    membership: {
      institutionId: string;
      institution: {
        name: string;
      };
    };
    brand: {
      name: string;
    } | null;
    model: {
      name: string;
    } | null;
  }): VehicleRecord {
    return {
      id: vehicle.id,
      membershipId: vehicle.membershipId,
      institutionId: vehicle.membership.institutionId,
      institutionName: vehicle.membership.institution.name,
      vehicleType: vehicle.vehicleType as VehicleType,
      brandId: vehicle.brandId,
      brandName: vehicle.brand?.name ?? null,
      modelId: vehicle.modelId,
      modelName: vehicle.model?.name ?? null,
      customBrandName: vehicle.customBrandName,
      customModelName: vehicle.customModelName,
      year: vehicle.year,
      color: vehicle.color,
      plate: vehicle.plate,
      seatCount: vehicle.seatCount,
      luggagePolicy: vehicle.luggagePolicy as LuggagePolicy,
      registrationDocumentFileKey: vehicle.registrationDocumentFileKey,
      isActive: vehicle.isActive,
      createdAt: vehicle.createdAt,
    };
  }
}
