import { Injectable } from '@nestjs/common';
import {
  CancellationTiming,
  getEffectiveTripRequestExecutionStatus,
  getCancellationTiming,
  MembershipStatus,
  TripRequestExecutionStatus,
  TripRequestStatus,
  TripRouteMode,
  TripStatus,
} from '@saferidepro/shared-types';

import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import {
  CreateTripRequestInput,
  TripRequestMembershipRecord,
  TripRequestRecord,
  TripRequestTripRecord,
  TripRequestsRepository,
} from '../../application/ports/trip-requests.repository';

const TRIP_REQUEST_CONFLICT = 'TRIP_REQUEST_CONFLICT';

@Injectable()
export class PrismaTripRequestsRepository implements TripRequestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findDefaultMembershipByUserId(
    userId: string,
  ): Promise<TripRequestMembershipRecord | null> {
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
        user: true,
      },
      orderBy: [{ isDefault: 'desc' }, { joinedAt: 'asc' }],
    });

    if (!membership) {
      return null;
    }

    return {
      id: membership.id,
      userId: membership.userId,
      fullName: membership.user.fullName,
      institutionId: membership.institutionId,
      institutionName: membership.institution.name,
      membershipStatus: membership.membershipStatus as MembershipStatus,
    };
  }

  async findTripById(tripId: string): Promise<TripRequestTripRecord | null> {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: this.tripInclude(),
    });

    return trip ? this.mapTrip(trip) : null;
  }

  async findTripRequestById(requestId: string): Promise<TripRequestRecord | null> {
    const tripRequest = await this.prisma.tripRequest.findUnique({
      where: { id: requestId },
      include: this.tripRequestInclude(),
    });

    return tripRequest ? this.mapTripRequest(tripRequest) : null;
  }

  async findActiveRequestForTripAndPassenger(
    tripId: string,
    passengerMembershipId: string,
  ): Promise<TripRequestRecord | null> {
    const tripRequest = await this.prisma.tripRequest.findFirst({
      where: {
        tripId,
        passengerMembershipId,
        status: {
          in: [TripRequestStatus.Pending, TripRequestStatus.Accepted],
        },
      },
      include: this.tripRequestInclude(),
      orderBy: {
        createdAt: 'desc',
      },
    });

    return tripRequest ? this.mapTripRequest(tripRequest) : null;
  }

  async createTripRequest(input: CreateTripRequestInput): Promise<TripRequestRecord> {
    const tripRequest = await this.prisma.tripRequest.create({
      data: {
        tripId: input.tripId,
        passengerMembershipId: input.passengerMembershipId,
        requestedPickupLatitude: input.requestedPickupLatitude,
        requestedPickupLongitude: input.requestedPickupLongitude,
        requestedDropoffLatitude: input.requestedDropoffLatitude,
        requestedDropoffLongitude: input.requestedDropoffLongitude,
        requestMessage: input.requestMessage,
      },
      include: this.tripRequestInclude(),
    });

    return this.mapTripRequest(tripRequest);
  }

  async listTripRequestsByPassengerMembershipId(
    passengerMembershipId: string,
  ): Promise<TripRequestRecord[]> {
    const tripRequests = await this.prisma.tripRequest.findMany({
      where: { passengerMembershipId },
      include: this.tripRequestInclude(),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return tripRequests.map((tripRequest) => this.mapTripRequest(tripRequest));
  }

  async listTripRequestsByDriverMembershipId(
    driverMembershipId: string,
  ): Promise<TripRequestRecord[]> {
    const tripRequests = await this.prisma.tripRequest.findMany({
      where: {
        trip: {
          driverMembershipId,
        },
      },
      include: this.tripRequestInclude(),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return tripRequests.map((tripRequest) => this.mapTripRequest(tripRequest));
  }

  async acceptTripRequest(
    requestId: string,
    reviewNote?: string,
  ): Promise<TripRequestRecord | null> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const currentTripRequest = await transaction.tripRequest.findUnique({
          where: { id: requestId },
          include: this.tripRequestInclude(),
        });

        if (!currentTripRequest) {
          throw new Error(TRIP_REQUEST_CONFLICT);
        }

        if (currentTripRequest.status !== TripRequestStatus.Pending) {
          throw new Error(TRIP_REQUEST_CONFLICT);
        }

        if (
          currentTripRequest.trip.status !== TripStatus.Published ||
          currentTripRequest.trip.availableSeats < 1
        ) {
          throw new Error(TRIP_REQUEST_CONFLICT);
        }

        const nextAvailableSeats = currentTripRequest.trip.availableSeats - 1;
        const tripUpdateResult = await transaction.trip.updateMany({
          where: {
            id: currentTripRequest.tripId,
            status: TripStatus.Published,
            availableSeats: currentTripRequest.trip.availableSeats,
          },
          data: {
            availableSeats: {
              decrement: 1,
            },
            status: nextAvailableSeats === 0 ? TripStatus.Full : TripStatus.Published,
          },
        });

        if (tripUpdateResult.count !== 1) {
          throw new Error(TRIP_REQUEST_CONFLICT);
        }

        const requestUpdateResult = await transaction.tripRequest.updateMany({
          where: {
            id: requestId,
            status: TripRequestStatus.Pending,
          },
          data: {
            status: TripRequestStatus.Accepted,
            executionStatus: TripRequestExecutionStatus.AcceptedPendingBoarding,
            reviewNote: reviewNote ?? null,
            executionStatusUpdatedAt: new Date(),
            boardedAt: null,
            droppedOffAt: null,
            reviewedAt: new Date(),
            cancelledAt: null,
          },
        });

        if (requestUpdateResult.count !== 1) {
          throw new Error(TRIP_REQUEST_CONFLICT);
        }

        const updatedTripRequest = await transaction.tripRequest.findUnique({
          where: { id: requestId },
          include: this.tripRequestInclude(),
        });

        if (!updatedTripRequest) {
          throw new Error(TRIP_REQUEST_CONFLICT);
        }

        return this.mapTripRequest(updatedTripRequest);
      });
    } catch (error) {
      if (error instanceof Error && error.message === TRIP_REQUEST_CONFLICT) {
        return null;
      }

      throw error;
    }
  }

  async rejectTripRequest(
    requestId: string,
    reviewNote?: string,
  ): Promise<TripRequestRecord | null> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const requestUpdateResult = await transaction.tripRequest.updateMany({
          where: {
            id: requestId,
            status: TripRequestStatus.Pending,
          },
          data: {
            status: TripRequestStatus.Rejected,
            reviewNote: reviewNote ?? null,
            reviewedAt: new Date(),
          },
        });

        if (requestUpdateResult.count !== 1) {
          throw new Error(TRIP_REQUEST_CONFLICT);
        }

        const updatedTripRequest = await transaction.tripRequest.findUnique({
          where: { id: requestId },
          include: this.tripRequestInclude(),
        });

        if (!updatedTripRequest) {
          throw new Error(TRIP_REQUEST_CONFLICT);
        }

        return this.mapTripRequest(updatedTripRequest);
      });
    } catch (error) {
      if (error instanceof Error && error.message === TRIP_REQUEST_CONFLICT) {
        return null;
      }

      throw error;
    }
  }

  async cancelTripRequest(requestId: string): Promise<TripRequestRecord | null> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const currentTripRequest = await transaction.tripRequest.findUnique({
          where: { id: requestId },
          include: this.tripRequestInclude(),
        });

        if (!currentTripRequest) {
          throw new Error(TRIP_REQUEST_CONFLICT);
        }

        if (
          currentTripRequest.status !== TripRequestStatus.Pending &&
          currentTripRequest.status !== TripRequestStatus.Accepted
        ) {
          throw new Error(TRIP_REQUEST_CONFLICT);
        }

        if (
          currentTripRequest.status === TripRequestStatus.Accepted &&
          (currentTripRequest.trip.status === TripStatus.Published ||
            currentTripRequest.trip.status === TripStatus.Full)
        ) {
          const nextAvailableSeats = Math.min(
            currentTripRequest.trip.seatCount,
            currentTripRequest.trip.availableSeats + 1,
          );
          const nextTripStatus =
            nextAvailableSeats === 0 ? TripStatus.Full : TripStatus.Published;

          const tripUpdateResult = await transaction.trip.updateMany({
            where: {
              id: currentTripRequest.tripId,
              status: currentTripRequest.trip.status,
              availableSeats: currentTripRequest.trip.availableSeats,
            },
            data: {
              availableSeats: nextAvailableSeats,
              status: nextTripStatus,
            },
          });

          if (tripUpdateResult.count !== 1) {
            throw new Error(TRIP_REQUEST_CONFLICT);
          }
        }

        const requestUpdateResult = await transaction.tripRequest.updateMany({
          where: {
            id: requestId,
            status: currentTripRequest.status,
          },
          data: {
            status: TripRequestStatus.Cancelled,
            executionStatus:
              currentTripRequest.status === TripRequestStatus.Accepted
                ? TripRequestExecutionStatus.CancelledBeforeBoarding
                : null,
            executionStatusUpdatedAt:
              currentTripRequest.status === TripRequestStatus.Accepted ? new Date() : null,
            cancelledAt: new Date(),
          },
        });

        if (requestUpdateResult.count !== 1) {
          throw new Error(TRIP_REQUEST_CONFLICT);
        }

        const updatedTripRequest = await transaction.tripRequest.findUnique({
          where: { id: requestId },
          include: this.tripRequestInclude(),
        });

        if (!updatedTripRequest) {
          throw new Error(TRIP_REQUEST_CONFLICT);
        }

        return this.mapTripRequest(updatedTripRequest);
      });
    } catch (error) {
      if (error instanceof Error && error.message === TRIP_REQUEST_CONFLICT) {
        return null;
      }

      throw error;
    }
  }

  async markTripRequestAsNoShow(
    requestId: string,
    reviewNote: string,
  ): Promise<TripRequestRecord | null> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const requestUpdateResult = await transaction.tripRequest.updateMany({
          where: {
            id: requestId,
            status: TripRequestStatus.Accepted,
            OR: [
              {
                executionStatus: null,
              },
              {
                executionStatus: TripRequestExecutionStatus.AcceptedPendingBoarding,
              },
            ],
          },
          data: {
            status: TripRequestStatus.NoShow,
            executionStatus: TripRequestExecutionStatus.NoShow,
            reviewNote,
            executionStatusUpdatedAt: new Date(),
            reviewedAt: new Date(),
            cancelledAt: null,
          },
        });

        if (requestUpdateResult.count !== 1) {
          throw new Error(TRIP_REQUEST_CONFLICT);
        }

        const updatedTripRequest = await transaction.tripRequest.findUnique({
          where: { id: requestId },
          include: this.tripRequestInclude(),
        });

        if (!updatedTripRequest) {
          throw new Error(TRIP_REQUEST_CONFLICT);
        }

        return this.mapTripRequest(updatedTripRequest);
      });
    } catch (error) {
      if (error instanceof Error && error.message === TRIP_REQUEST_CONFLICT) {
        return null;
      }

      throw error;
    }
  }

  async markTripRequestBoarded(requestId: string): Promise<TripRequestRecord | null> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const requestUpdateResult = await transaction.tripRequest.updateMany({
          where: {
            id: requestId,
            status: TripRequestStatus.Accepted,
            OR: [
              {
                executionStatus: null,
              },
              {
                executionStatus: TripRequestExecutionStatus.AcceptedPendingBoarding,
              },
            ],
            trip: {
              status: TripStatus.InProgress,
            },
          },
          data: {
            executionStatus: TripRequestExecutionStatus.OnBoard,
            executionStatusUpdatedAt: new Date(),
            boardedAt: new Date(),
          },
        });

        if (requestUpdateResult.count !== 1) {
          throw new Error(TRIP_REQUEST_CONFLICT);
        }

        const updatedTripRequest = await transaction.tripRequest.findUnique({
          where: { id: requestId },
          include: this.tripRequestInclude(),
        });

        if (!updatedTripRequest) {
          throw new Error(TRIP_REQUEST_CONFLICT);
        }

        return this.mapTripRequest(updatedTripRequest);
      });
    } catch (error) {
      if (error instanceof Error && error.message === TRIP_REQUEST_CONFLICT) {
        return null;
      }

      throw error;
    }
  }

  async markTripRequestDroppedOff(requestId: string): Promise<TripRequestRecord | null> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const requestUpdateResult = await transaction.tripRequest.updateMany({
          where: {
            id: requestId,
            status: TripRequestStatus.Accepted,
            executionStatus: TripRequestExecutionStatus.OnBoard,
            trip: {
              status: TripStatus.InProgress,
            },
          },
          data: {
            executionStatus: TripRequestExecutionStatus.DroppedOff,
            executionStatusUpdatedAt: new Date(),
            droppedOffAt: new Date(),
          },
        });

        if (requestUpdateResult.count !== 1) {
          throw new Error(TRIP_REQUEST_CONFLICT);
        }

        const updatedTripRequest = await transaction.tripRequest.findUnique({
          where: { id: requestId },
          include: this.tripRequestInclude(),
        });

        if (!updatedTripRequest) {
          throw new Error(TRIP_REQUEST_CONFLICT);
        }

        return this.mapTripRequest(updatedTripRequest);
      });
    } catch (error) {
      if (error instanceof Error && error.message === TRIP_REQUEST_CONFLICT) {
        return null;
      }

      throw error;
    }
  }

  private tripInclude() {
    return {
      institution: true,
      driverMembership: {
        include: {
          user: true,
        },
      },
    } as const;
  }

  private tripRequestInclude() {
    return {
      trip: {
        include: {
          institution: true,
          driverMembership: {
            include: {
              user: true,
            },
          },
        },
      },
      passengerMembership: {
        include: {
          institution: true,
          user: true,
        },
      },
    } as const;
  }

  private mapTrip(trip: {
    id: string;
    institutionId: string;
    status: string;
    routeMode: string;
    originLabel: string;
    destinationLabel: string;
    departureAt: Date;
    estimatedArrivalAt: Date;
    seatCount: number;
    availableSeats: number;
    driverMembershipId: string;
    institution: { name: string };
    driverMembership: {
      userId: string;
      user: { fullName: string };
    };
  }): TripRequestTripRecord {
    return {
      id: trip.id,
      institutionId: trip.institutionId,
      institutionName: trip.institution.name,
      driverMembershipId: trip.driverMembershipId,
      driverUserId: trip.driverMembership.userId,
      driverFullName: trip.driverMembership.user.fullName,
      status: trip.status as TripStatus,
      routeMode: trip.routeMode as TripRouteMode,
      originLabel: trip.originLabel,
      destinationLabel: trip.destinationLabel,
      departureAt: trip.departureAt,
      estimatedArrivalAt: trip.estimatedArrivalAt,
      seatCount: trip.seatCount,
      availableSeats: trip.availableSeats,
    };
  }

  private mapTripRequest(tripRequest: {
    id: string;
    tripId: string;
    passengerMembershipId: string;
    status: string;
    executionStatus: string | null;
    requestedPickupLatitude: number | null;
    requestedPickupLongitude: number | null;
    requestedDropoffLatitude: number | null;
    requestedDropoffLongitude: number | null;
    requestMessage: string | null;
    reviewNote: string | null;
    executionStatusUpdatedAt: Date | null;
    boardedAt: Date | null;
    droppedOffAt: Date | null;
    createdAt: Date;
    reviewedAt: Date | null;
    cancelledAt: Date | null;
    trip: {
      institutionId: string;
      originLabel: string;
      destinationLabel: string;
      departureAt: Date;
      estimatedArrivalAt: Date;
      completedAt: Date | null;
      closureNote: string | null;
      cancelledAt: Date | null;
      seatCount: number;
      availableSeats: number;
      status: string;
      routeMode: string;
      driverMembershipId: string;
      institution: { name: string };
      driverMembership: {
        userId: string;
        user: { fullName: string };
      };
    };
    passengerMembership: {
      userId: string;
      user: { fullName: string };
    };
  }): TripRequestRecord {
    return {
      id: tripRequest.id,
      tripId: tripRequest.tripId,
      institutionId: tripRequest.trip.institutionId,
      institutionName: tripRequest.trip.institution.name,
      driverMembershipId: tripRequest.trip.driverMembershipId,
      driverUserId: tripRequest.trip.driverMembership.userId,
      driverFullName: tripRequest.trip.driverMembership.user.fullName,
      passengerMembershipId: tripRequest.passengerMembershipId,
      passengerUserId: tripRequest.passengerMembership.userId,
      passengerFullName: tripRequest.passengerMembership.user.fullName,
      status: tripRequest.status as TripRequestStatus,
      executionStatus: getEffectiveTripRequestExecutionStatus({
        requestStatus: tripRequest.status,
        executionStatus: tripRequest.executionStatus as TripRequestExecutionStatus | null,
      }),
      tripStatus: tripRequest.trip.status as TripStatus,
      tripRouteMode: tripRequest.trip.routeMode as TripRouteMode,
      tripOriginLabel: tripRequest.trip.originLabel,
      tripDestinationLabel: tripRequest.trip.destinationLabel,
      tripDepartureAt: tripRequest.trip.departureAt,
      tripEstimatedArrivalAt: tripRequest.trip.estimatedArrivalAt,
      tripCompletedAt: tripRequest.trip.completedAt,
      tripClosureNote: tripRequest.trip.closureNote,
      tripCancelledAt: tripRequest.trip.cancelledAt,
      tripSeatCount: tripRequest.trip.seatCount,
      tripAvailableSeats: tripRequest.trip.availableSeats,
      requestedPickupLatitude: tripRequest.requestedPickupLatitude,
      requestedPickupLongitude: tripRequest.requestedPickupLongitude,
      requestedDropoffLatitude: tripRequest.requestedDropoffLatitude,
      requestedDropoffLongitude: tripRequest.requestedDropoffLongitude,
      requestMessage: tripRequest.requestMessage,
      reviewNote: tripRequest.reviewNote,
      executionStatusUpdatedAt: tripRequest.executionStatusUpdatedAt,
      boardedAt: tripRequest.boardedAt,
      droppedOffAt: tripRequest.droppedOffAt,
      createdAt: tripRequest.createdAt,
      reviewedAt: tripRequest.reviewedAt,
      cancelledAt: tripRequest.cancelledAt,
      cancellationTiming: getCancellationTiming({
        departureAt: tripRequest.trip.departureAt,
        cancelledAt: tripRequest.cancelledAt,
      }),
    };
  }
}
