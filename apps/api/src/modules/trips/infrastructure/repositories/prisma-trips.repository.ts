import { Injectable } from '@nestjs/common';
import {
  CancellationTiming,
  DriverLicenseStatus,
  DriverVerificationStatus,
  getCancellationTiming,
  getDaysUntilDriverLicenseExpiration,
  getDriverLicenseStatus,
  getEffectiveDriverVerificationStatus,
  LuggagePolicy,
  MembershipStatus,
  TripRequestStatus,
  TripRouteMode,
  TripStatus,
  VehicleType,
} from '@saferidepro/shared-types';

import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import {
  CreateTripInput,
  TripFilters,
  TripMembershipRecord,
  TripRecord,
  TripsRepository,
  TripVehicleRecord,
} from '../../application/ports/trips.repository';

@Injectable()
export class PrismaTripsRepository implements TripsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findDefaultMembershipByUserId(userId: string): Promise<TripMembershipRecord | null> {
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

  async findVehicleByIdForMembership(
    membershipId: string,
    vehicleId: string,
  ): Promise<TripVehicleRecord | null> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        membershipId,
      },
      include: {
        brand: true,
        model: true,
      },
    });

    if (!vehicle) {
      return null;
    }

    return {
      id: vehicle.id,
      membershipId: vehicle.membershipId,
      isActive: vehicle.isActive,
      seatCount: vehicle.seatCount,
      luggagePolicy: vehicle.luggagePolicy as LuggagePolicy,
      vehicleType: vehicle.vehicleType as VehicleType,
      plate: vehicle.plate,
      displayName: this.buildVehicleDisplayName(vehicle),
    };
  }

  async createTrip(input: CreateTripInput): Promise<TripRecord> {
    const trip = await this.prisma.trip.create({
      data: {
        institutionId: input.institutionId,
        driverMembershipId: input.driverMembershipId,
        vehicleId: input.vehicleId,
        routeMode: input.routeMode,
        originLabel: input.originLabel,
        destinationLabel: input.destinationLabel,
        originLatitude: input.originLatitude,
        originLongitude: input.originLongitude,
        destinationLatitude: input.destinationLatitude,
        destinationLongitude: input.destinationLongitude,
        departureAt: input.departureAt,
        estimatedArrivalAt: input.estimatedArrivalAt,
        seatCount: input.seatCount,
        availableSeats: input.availableSeats,
        vehicleTypeSnapshot: input.vehicleTypeSnapshot,
        luggagePolicySnapshot: input.luggagePolicySnapshot,
        basePriceReference: input.basePriceReference,
        detourSurchargeReference: input.detourSurchargeReference,
        notes: input.notes,
      },
      include: this.tripInclude(),
    });

    return this.mapTrip(trip);
  }

  async findTripById(tripId: string): Promise<TripRecord | null> {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: this.tripInclude(),
    });

    return trip ? this.mapTrip(trip) : null;
  }

  async listTrips(filters: TripFilters): Promise<TripRecord[]> {
    const trips = await this.prisma.trip.findMany({
      where: {
        institutionId: filters.institutionId,
        driverMembershipId: filters.driverMembershipId,
        status: filters.statuses ? { in: filters.statuses } : undefined,
        routeMode: filters.routeMode,
        vehicleTypeSnapshot: filters.vehicleType,
        originLabel: filters.originSearch
          ? { contains: filters.originSearch, mode: 'insensitive' }
          : undefined,
        destinationLabel: filters.destinationSearch
          ? { contains: filters.destinationSearch, mode: 'insensitive' }
          : undefined,
        departureAt: {
          gte: filters.dateFrom,
          lte: filters.dateTo,
        },
      },
      include: this.tripInclude(),
      orderBy: {
        departureAt: 'asc',
      },
    });

    return trips.map((trip) => this.mapTrip(trip));
  }

  async findOverlappingTrips(
    driverMembershipId: string,
    departureAt: Date,
    estimatedArrivalAt: Date,
    excludeTripId?: string,
  ): Promise<TripRecord[]> {
    const trips = await this.prisma.trip.findMany({
      where: {
        driverMembershipId,
        status: {
          in: ['PUBLISHED', 'FULL', 'IN_PROGRESS'],
        },
        id: excludeTripId
          ? {
              not: excludeTripId,
            }
          : undefined,
        departureAt: {
          lt: estimatedArrivalAt,
        },
        estimatedArrivalAt: {
          gt: departureAt,
        },
      },
      include: this.tripInclude(),
    });

    return trips.map((trip) => this.mapTrip(trip));
  }

  async updateTripStatus(tripId: string, status: TripStatus): Promise<TripRecord> {
    const trip = await this.prisma.trip.update({
      where: { id: tripId },
      data: { status },
      include: this.tripInclude(),
    });

    return this.mapTrip(trip);
  }

  async cancelTripAndActiveRequests(tripId: string): Promise<TripRecord> {
    const trip = await this.prisma.$transaction(async (transaction) => {
      const cancellationDate = new Date();

      await transaction.tripRequest.updateMany({
        where: {
          tripId,
          status: {
            in: [TripRequestStatus.Pending, TripRequestStatus.Accepted],
          },
        },
        data: {
          status: TripRequestStatus.Cancelled,
          cancelledAt: cancellationDate,
        },
      });

      return transaction.trip.update({
        where: { id: tripId },
        data: {
          status: TripStatus.Cancelled,
          cancelledAt: cancellationDate,
        },
        include: this.tripInclude(),
      });
    });

    return this.mapTrip(trip);
  }

  async startTripAndClosePendingRequests(
    tripId: string,
    autoReviewNote: string,
  ): Promise<TripRecord> {
    const trip = await this.prisma.$transaction(async (transaction) => {
      const reviewDate = new Date();

      await transaction.tripRequest.updateMany({
        where: {
          tripId,
          status: TripRequestStatus.Pending,
        },
        data: {
          status: TripRequestStatus.Rejected,
          reviewNote: autoReviewNote,
          reviewedAt: reviewDate,
        },
      });

      return transaction.trip.update({
        where: { id: tripId },
        data: { status: TripStatus.InProgress },
        include: this.tripInclude(),
      });
    });

    return this.mapTrip(trip);
  }

  private tripInclude() {
    return {
      institution: true,
      driverMembership: {
        include: {
          user: true,
        },
      },
      vehicle: {
        include: {
          brand: true,
          model: true,
        },
      },
    } as const;
  }

  private mapTrip(trip: {
    id: string;
    institutionId: string;
    driverMembershipId: string;
    vehicleId: string;
    status: string;
    routeMode: string;
    originLabel: string;
    destinationLabel: string;
    originLatitude: number;
    originLongitude: number;
    destinationLatitude: number;
    destinationLongitude: number;
    departureAt: Date;
    estimatedArrivalAt: Date;
    seatCount: number;
    availableSeats: number;
    vehicleTypeSnapshot: string;
    luggagePolicySnapshot: string;
    basePriceReference: { toString(): string };
    detourSurchargeReference: { toString(): string } | null;
    notes: string | null;
    cancelledAt: Date | null;
    createdAt: Date;
    institution: { name: string };
    driverMembership: {
      user: { fullName: string };
    };
    vehicle: {
      plate: string;
      brand: { name: string } | null;
      model: { name: string } | null;
      customBrandName: string | null;
      customModelName: string | null;
    };
  }): TripRecord {
    return {
      id: trip.id,
      institutionId: trip.institutionId,
      institutionName: trip.institution.name,
      driverMembershipId: trip.driverMembershipId,
      driverFullName: trip.driverMembership.user.fullName,
      vehicleId: trip.vehicleId,
      vehiclePlate: trip.vehicle.plate,
      vehicleDisplayName: this.buildVehicleDisplayName(trip.vehicle),
      status: trip.status as TripStatus,
      routeMode: trip.routeMode as TripRouteMode,
      originLabel: trip.originLabel,
      destinationLabel: trip.destinationLabel,
      originLatitude: trip.originLatitude,
      originLongitude: trip.originLongitude,
      destinationLatitude: trip.destinationLatitude,
      destinationLongitude: trip.destinationLongitude,
      departureAt: trip.departureAt,
      estimatedArrivalAt: trip.estimatedArrivalAt,
      seatCount: trip.seatCount,
      availableSeats: trip.availableSeats,
      vehicleTypeSnapshot: trip.vehicleTypeSnapshot as VehicleType,
      luggagePolicySnapshot: trip.luggagePolicySnapshot as LuggagePolicy,
      basePriceReference: Number.parseFloat(trip.basePriceReference.toString()),
      detourSurchargeReference: trip.detourSurchargeReference
        ? Number.parseFloat(trip.detourSurchargeReference.toString())
        : null,
      notes: trip.notes,
      cancelledAt: trip.cancelledAt,
      cancellationTiming: getCancellationTiming({
        departureAt: trip.departureAt,
        cancelledAt: trip.cancelledAt,
      }),
      createdAt: trip.createdAt,
    };
  }

  private buildVehicleDisplayName(vehicle: {
    brand?: { name: string } | null;
    model?: { name: string } | null;
    customBrandName?: string | null;
    customModelName?: string | null;
  }): string {
    const brandName = vehicle.brand?.name ?? vehicle.customBrandName ?? 'Vehiculo';
    const modelName = vehicle.model?.name ?? vehicle.customModelName ?? '';

    return `${brandName} ${modelName}`.trim();
  }
}
