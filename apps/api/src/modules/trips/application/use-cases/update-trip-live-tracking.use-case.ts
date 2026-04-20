import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { MembershipStatus, TripStatus } from '@saferidepro/shared-types';

import { RealtimeEventsService } from '../../../realtime/application/services/realtime-events.service';
import {
  TRIPS_REPOSITORY,
  TripsRepository,
} from '../ports/trips.repository';
import { mapTripLiveTrackingResponse } from '../services/trip-live-tracking-response';
import { TripLifecycleMaintenanceService } from '../services/trip-lifecycle-maintenance.service';

export type UpdateTripLiveTrackingCommand = {
  userId: string;
  tripId: string;
  capturedAt: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  headingDegrees?: number;
  speedKph?: number;
};

@Injectable()
export class UpdateTripLiveTrackingUseCase {
  constructor(
    @Inject(TRIPS_REPOSITORY)
    private readonly tripsRepository: TripsRepository,
    private readonly tripLifecycleMaintenanceService: TripLifecycleMaintenanceService,
    @Optional()
    private readonly realtimeEventsService: RealtimeEventsService = new RealtimeEventsService(),
  ) {}

  async execute(command: UpdateTripLiveTrackingCommand) {
    const membership = await this.tripsRepository.findDefaultMembershipByUserId(command.userId);

    if (!membership || membership.membershipStatus !== MembershipStatus.Active) {
      throw new ForbiddenException('No tienes una membresia activa para compartir ubicacion.');
    }

    const trip = await this.tripsRepository.findTripById(command.tripId);

    if (!trip) {
      throw new NotFoundException('El viaje solicitado no existe.');
    }

    const reconciledTrip = await this.tripLifecycleMaintenanceService.reconcileTripLifecycle(trip);

    if (reconciledTrip.institutionId !== membership.institutionId) {
      throw new NotFoundException('El viaje solicitado no existe.');
    }

    if (reconciledTrip.driverMembershipId !== membership.id) {
      throw new ForbiddenException(
        'Solo el conductor propietario puede compartir seguimiento en vivo.',
      );
    }

    if (reconciledTrip.status !== TripStatus.InProgress) {
      throw new BadRequestException(
        'Solo puedes compartir ubicacion mientras el viaje esta en curso.',
      );
    }

    const capturedAt = new Date(command.capturedAt);

    if (Number.isNaN(capturedAt.getTime())) {
      throw new BadRequestException('La marca temporal del tracking no es valida.');
    }

    if (capturedAt.getTime() > Date.now() + 60_000) {
      throw new BadRequestException('La ubicacion reportada no puede venir del futuro.');
    }

    const tracking = await this.tripsRepository.recordTripLiveTrackingPosition({
      tripId: reconciledTrip.id,
      capturedAt,
      latitude: command.latitude,
      longitude: command.longitude,
      accuracyMeters: command.accuracyMeters,
      headingDegrees: command.headingDegrees,
      speedKph: command.speedKph,
    });

    const recipientMembershipIds = [
      membership.id,
      ...(await this.tripsRepository.findAcceptedPassengerMembershipIds(reconciledTrip.id)),
    ];

    this.realtimeEventsService.publishTripLiveTrackingUpdated({
      actorUserId: command.userId,
      institutionId: reconciledTrip.institutionId,
      tripId: reconciledTrip.id,
      driverMembershipId: membership.id,
      recipientMembershipIds,
      trackingStatus: tracking.status,
      lastSignalAt: tracking.lastSignalAt,
      currentLatitude: tracking.currentLatitude,
      currentLongitude: tracking.currentLongitude,
      currentAccuracyMeters: tracking.currentAccuracyMeters,
      currentHeadingDegrees: tracking.currentHeadingDegrees,
      currentSpeedKph: tracking.currentSpeedKph,
    });

    return mapTripLiveTrackingResponse(tracking);
  }
}
