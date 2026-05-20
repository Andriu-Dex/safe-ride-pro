import { Injectable } from '@nestjs/common';
import {
  CancellationTiming,
  DriverLicenseStatus,
  DriverVerificationStatus,
  getCancellationTiming,
  getDaysUntilDriverLicenseExpiration,
  getDriverLicenseStatus,
  getEffectiveDriverVerificationStatus,
  getEffectiveTripRequestExecutionStatus,
  LuggagePolicy,
  MembershipStatus,
  TripAvailabilityFilter,
  TripRequestExecutionStatus,
  TripLiveTrackingStatus,
  TripRequestStatus,
  TripRouteMode,
  TripStatus,
  VehicleType,
} from '@saferidepro/shared-types';

import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import {
  CompleteTripInput,
  CreateTripInput,
  RecordTripLiveTrackingPositionInput,
  TripExecutionPassengerRecord,
  TripFilters,
  TripLiveTrackingRecord,
  TripMembershipRecord,
  TripRecord,
  TripsRepository,
  UpdateTripInput,
  TripVehicleRecord,
} from '../../application/ports/trips.repository';
import { matchesTripDepartureTimeWindow } from '../../application/services/trip-search-filtering';

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
        liveTracking: {
          create: {
            status: TripLiveTrackingStatus.Ready,
          },
        },
      },
      include: this.tripInclude(),
    });

    return this.mapTrip(trip);
  }

  async updateTrip(input: UpdateTripInput): Promise<TripRecord> {
    const trip = await this.prisma.trip.update({
      where: { id: input.tripId },
      data: {
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
        status: input.status,
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

  async countActiveRequestsForTrip(tripId: string): Promise<number> {
    return this.prisma.tripRequest.count({
      where: {
        tripId,
        status: {
          in: [TripRequestStatus.Pending, TripRequestStatus.Accepted],
        },
      },
    });
  }

  async listTripExecutionPassengers(tripId: string): Promise<TripExecutionPassengerRecord[]> {
    const tripRequests = await this.prisma.tripRequest.findMany({
      where: {
        tripId,
        status: {
          in: [TripRequestStatus.Accepted, TripRequestStatus.NoShow],
        },
      },
      include: {
        passengerMembership: {
          include: {
            user: true,
          },
        },
      },
      orderBy: [{ reviewedAt: 'asc' }, { createdAt: 'asc' }],
    });

    return tripRequests.map((tripRequest) => ({
      requestId: tripRequest.id,
      passengerMembershipId: tripRequest.passengerMembershipId,
      passengerFullName: tripRequest.passengerMembership.user.fullName,
      status: tripRequest.status as TripRequestStatus,
      executionStatus: getEffectiveTripRequestExecutionStatus({
        requestStatus: tripRequest.status,
        executionStatus: tripRequest.executionStatus as TripRequestExecutionStatus | null,
      }),
      boardedAt: tripRequest.boardedAt,
      droppedOffAt: tripRequest.droppedOffAt,
    }));
  }

  async hasAcceptedTripRequest(
    tripId: string,
    passengerMembershipId: string,
  ): Promise<boolean> {
    const acceptedTripRequest = await this.prisma.tripRequest.findFirst({
      where: {
        tripId,
        passengerMembershipId,
        status: TripRequestStatus.Accepted,
      },
      select: {
        id: true,
      },
    });

    return Boolean(acceptedTripRequest);
  }

  async findAcceptedPassengerMembershipIds(tripId: string): Promise<string[]> {
    const acceptedRequests = await this.prisma.tripRequest.findMany({
      where: {
        tripId,
        status: TripRequestStatus.Accepted,
      },
      select: {
        passengerMembershipId: true,
      },
    });

    return acceptedRequests.map((request) => request.passengerMembershipId);
  }

  async findLatestReusableTripByDriverMembershipId(
    driverMembershipId: string,
  ): Promise<TripRecord | null> {
    const trip = await this.prisma.trip.findFirst({
      where: {
        driverMembershipId,
        status: {
          in: [
            TripStatus.Draft,
            TripStatus.Published,
            TripStatus.Full,
            TripStatus.InProgress,
            TripStatus.Completed,
          ],
        },
      },
      include: this.tripInclude(),
      orderBy: [{ createdAt: 'desc' }, { departureAt: 'desc' }],
    });

    return trip ? this.mapTrip(trip) : null;
  }

  async listRecentReusableTripsByDriverMembershipId(
    driverMembershipId: string,
    limit: number,
  ): Promise<TripRecord[]> {
    const trips = await this.prisma.trip.findMany({
      where: {
        driverMembershipId,
        status: {
          in: [
            TripStatus.Draft,
            TripStatus.Published,
            TripStatus.Full,
            TripStatus.InProgress,
            TripStatus.Completed,
          ],
        },
      },
      include: this.tripInclude(),
      orderBy: [{ createdAt: 'desc' }, { departureAt: 'desc' }],
      take: limit,
    });

    return trips.map((trip) => this.mapTrip(trip));
  }

  async listTrips(filters: TripFilters): Promise<TripRecord[]> {
    const trips = await this.prisma.trip.findMany({
      where: {
        institutionId: filters.institutionId,
        driverMembershipId: filters.driverMembershipId,
        status: filters.statuses ? { in: filters.statuses } : undefined,
        routeMode: filters.routeMode,
        vehicleTypeSnapshot: filters.vehicleType,
        availableSeats:
          filters.availability === TripAvailabilityFilter.Available
            ? { gt: 0 }
            : filters.availability === TripAvailabilityFilter.Full
              ? 0
              : undefined,
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

    return trips
      .filter((trip) =>
        matchesTripDepartureTimeWindow(
          trip.departureAt,
          filters.timeFromInMinutes,
          filters.timeToInMinutes,
        ),
      )
      .map((trip) => this.mapTrip(trip));
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

  async autoCancelTripForDriverAbsence(tripId: string): Promise<TripRecord | null> {
    const trip = await this.prisma.$transaction(async (transaction) => {
      const cancellationDate = new Date();
      const updatedTrips = await transaction.trip.updateMany({
        where: {
          id: tripId,
          status: {
            in: [TripStatus.Published, TripStatus.Full],
          },
        },
        data: {
          status: TripStatus.Cancelled,
          cancelledAt: cancellationDate,
        },
      });

      if (updatedTrips.count === 0) {
        return null;
      }

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

      await transaction.tripLiveTracking.upsert({
        where: { tripId },
        create: {
          tripId,
          status: TripLiveTrackingStatus.Ended,
          endedAt: cancellationDate,
        },
        update: {
          status: TripLiveTrackingStatus.Ended,
          endedAt: cancellationDate,
        },
      });

      return transaction.trip.findUnique({
        where: { id: tripId },
        include: this.tripInclude(),
      });
    });

    return trip ? this.mapTrip(trip) : null;
  }

  async deleteDraftTrip(tripId: string): Promise<void> {
    await this.prisma.trip.delete({
      where: { id: tripId },
    });
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

      await transaction.tripLiveTracking.upsert({
        where: { tripId },
        create: {
          tripId,
          status: TripLiveTrackingStatus.Ended,
          endedAt: cancellationDate,
        },
        update: {
          status: TripLiveTrackingStatus.Ended,
          endedAt: cancellationDate,
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

  async completeTrip(input: CompleteTripInput): Promise<TripRecord> {
    const trip = await this.prisma.trip.update({
      where: { id: input.tripId },
      data: {
        status: TripStatus.Completed,
        completedAt: input.completedAt,
        closureNote: input.closureNote ?? null,
      },
      include: this.tripInclude(),
    });

    return this.mapTrip(trip);
  }

  async getTripLiveTrackingByTripId(
    tripId: string,
    historyLimit = 40,
  ): Promise<TripLiveTrackingRecord | null> {
    const tracking = await this.prisma.tripLiveTracking.findUnique({
      where: { tripId },
      include: {
        points: {
          orderBy: {
            capturedAt: 'desc',
          },
          take: historyLimit,
        },
      },
    });

    if (!tracking) {
      return null;
    }

    return this.mapTripLiveTracking(tracking);
  }

  async activateTripLiveTracking(tripId: string): Promise<TripLiveTrackingRecord> {
    const existingTracking = await this.prisma.tripLiveTracking.findUnique({
      where: { tripId },
      select: {
        startedAt: true,
      },
    });

    const tracking = await this.prisma.tripLiveTracking.upsert({
      where: { tripId },
      create: {
        tripId,
        status: TripLiveTrackingStatus.Active,
        startedAt: new Date(),
      },
      update: {
        status: TripLiveTrackingStatus.Active,
        startedAt: {
          set: existingTracking?.startedAt ?? new Date(),
        },
        endedAt: null,
      },
      include: {
        points: {
          orderBy: {
            capturedAt: 'desc',
          },
          take: 40,
        },
      },
    });

    return this.mapTripLiveTracking(tracking);
  }

  async recordTripLiveTrackingPosition(
    input: RecordTripLiveTrackingPositionInput,
  ): Promise<TripLiveTrackingRecord> {
    const tracking = await this.prisma.$transaction(async (transaction) => {
      const currentTracking = await transaction.tripLiveTracking.findUnique({
        where: { tripId: input.tripId },
        select: {
          id: true,
          startedAt: true,
        },
      });

      const existingTracking = await transaction.tripLiveTracking.upsert({
        where: { tripId: input.tripId },
        create: {
          tripId: input.tripId,
          status: TripLiveTrackingStatus.Active,
          startedAt: input.capturedAt,
          lastSignalAt: input.capturedAt,
          currentLatitude: input.latitude,
          currentLongitude: input.longitude,
          currentAccuracyMeters: input.accuracyMeters ?? null,
          currentHeadingDegrees: input.headingDegrees ?? null,
          currentSpeedKph: input.speedKph ?? null,
        },
        update: {
          status: TripLiveTrackingStatus.Active,
          startedAt: {
            set: currentTracking?.startedAt ?? input.capturedAt,
          },
          endedAt: null,
          lastSignalAt: input.capturedAt,
          currentLatitude: input.latitude,
          currentLongitude: input.longitude,
          currentAccuracyMeters: input.accuracyMeters ?? null,
          currentHeadingDegrees: input.headingDegrees ?? null,
          currentSpeedKph: input.speedKph ?? null,
        },
      });

      await transaction.tripLiveTrackingPoint.create({
        data: {
          trackingId: currentTracking?.id ?? existingTracking.id,
          capturedAt: input.capturedAt,
          latitude: input.latitude,
          longitude: input.longitude,
          accuracyMeters: input.accuracyMeters ?? null,
          headingDegrees: input.headingDegrees ?? null,
          speedKph: input.speedKph ?? null,
        },
      });

      return transaction.tripLiveTracking.findUniqueOrThrow({
        where: { tripId: input.tripId },
        include: {
          points: {
            orderBy: {
              capturedAt: 'desc',
            },
            take: 40,
          },
        },
      });
    });

    return this.mapTripLiveTracking(tracking);
  }

  async endTripLiveTracking(tripId: string): Promise<TripLiveTrackingRecord | null> {
    const existingTracking = await this.prisma.tripLiveTracking.findUnique({
      where: { tripId },
      select: {
        tripId: true,
      },
    });

    if (!existingTracking) {
      return null;
    }

    const tracking = await this.prisma.tripLiveTracking.update({
      where: { tripId },
      data: {
        status: TripLiveTrackingStatus.Ended,
        endedAt: new Date(),
      },
      include: {
        points: {
          orderBy: {
            capturedAt: 'desc',
          },
          take: 40,
        },
      },
    });

    return this.mapTripLiveTracking(tracking);
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
    closureNote: string | null;
    cancelledAt: Date | null;
    completedAt: Date | null;
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
      closureNote: trip.closureNote,
      cancelledAt: trip.cancelledAt,
      completedAt: trip.completedAt,
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

  private mapTripLiveTracking(tracking: {
    tripId: string;
    status: string;
    startedAt: Date | null;
    endedAt: Date | null;
    lastSignalAt: Date | null;
    currentLatitude: number | null;
    currentLongitude: number | null;
    currentAccuracyMeters: number | null;
    currentHeadingDegrees: number | null;
    currentSpeedKph: number | null;
    points: Array<{
      capturedAt: Date;
      latitude: number;
      longitude: number;
      accuracyMeters: number | null;
      headingDegrees: number | null;
      speedKph: number | null;
    }>;
  }): TripLiveTrackingRecord {
    return {
      tripId: tracking.tripId,
      status: tracking.status as TripLiveTrackingStatus,
      startedAt: tracking.startedAt,
      endedAt: tracking.endedAt,
      lastSignalAt: tracking.lastSignalAt,
      currentLatitude: tracking.currentLatitude,
      currentLongitude: tracking.currentLongitude,
      currentAccuracyMeters: tracking.currentAccuracyMeters,
      currentHeadingDegrees: tracking.currentHeadingDegrees,
      currentSpeedKph: tracking.currentSpeedKph,
      history: [...tracking.points]
        .reverse()
        .map((point) => ({
          capturedAt: point.capturedAt,
          latitude: point.latitude,
          longitude: point.longitude,
          accuracyMeters: point.accuracyMeters,
          headingDegrees: point.headingDegrees,
          speedKph: point.speedKph,
        })),
    };
  }
}
