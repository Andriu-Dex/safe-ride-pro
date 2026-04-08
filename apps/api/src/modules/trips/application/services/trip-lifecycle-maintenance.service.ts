import { Inject, Injectable, Optional } from '@nestjs/common';
import { shouldAutoCancelTripForDriverAbsence } from '@saferidepro/shared-types';

import { AuditService } from '../../../audit/application/services/audit.service';
import { AuditAction, AuditEntityType } from '../../../audit/domain/audit.types';
import { RealtimeEventsService } from '../../../realtime/application/services/realtime-events.service';
import { OperationalSanctionsService } from '../../../sanctions/application/services/operational-sanctions.service';
import {
  TRIPS_REPOSITORY,
  TripRecord,
  TripsRepository,
} from '../ports/trips.repository';

const SYSTEM_REALTIME_ACTOR = 'system';
const AUTO_DRIVER_ABSENCE_REASON = 'AUTO_DRIVER_ABSENCE';

@Injectable()
export class TripLifecycleMaintenanceService {
  constructor(
    @Inject(TRIPS_REPOSITORY)
    private readonly tripsRepository: TripsRepository,
    private readonly auditService: AuditService,
    private readonly operationalSanctionsService: OperationalSanctionsService,
    @Optional()
    private readonly realtimeEventsService: RealtimeEventsService = new RealtimeEventsService(),
  ) {}

  async reconcileTripLifecycle(trip: TripRecord): Promise<TripRecord> {
    if (!shouldAutoCancelTripForDriverAbsence({ status: trip.status, departureAt: trip.departureAt })) {
      return trip;
    }

    const updatedTrip = await this.tripsRepository.autoCancelTripForDriverAbsence(trip.id);

    if (!updatedTrip) {
      return (await this.tripsRepository.findTripById(trip.id)) ?? trip;
    }

    await this.auditService.record({
      institutionId: trip.institutionId,
      action: AuditAction.TripCancelled,
      entityType: AuditEntityType.Trip,
      entityId: trip.id,
      metadata: {
        status: updatedTrip.status,
        reason: AUTO_DRIVER_ABSENCE_REASON,
        source: 'SYSTEM',
      },
    });

    await this.operationalSanctionsService.synchronizeAutomaticSanctions(trip.driverMembershipId);

    this.realtimeEventsService.publishTripChanged({
      actorUserId: SYSTEM_REALTIME_ACTOR,
      institutionId: trip.institutionId,
      reason: 'cancelled',
      tripId: trip.id,
    });

    return updatedTrip;
  }

  async reconcileTripCollection(trips: TripRecord[]): Promise<TripRecord[]> {
    const reconciledTrips = await Promise.all(
      trips.map((trip) => this.reconcileTripLifecycle(trip)),
    );

    return reconciledTrips;
  }

  filterTripsByStatuses(
    trips: TripRecord[],
    statuses?: Array<TripRecord['status']>,
  ): TripRecord[] {
    if (!statuses?.length) {
      return trips;
    }

    return trips.filter((trip) => statuses.includes(trip.status));
  }
}
