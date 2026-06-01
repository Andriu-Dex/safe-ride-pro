import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  DriverLicenseStatus,
  DriverVerificationStatus,
  MembershipStatus,
  TripRouteMode,
  TripStatus,
} from '@saferidepro/shared-types';

import { AuditService } from '../../../audit/application/services/audit.service';
import { AuditAction, AuditEntityType } from '../../../audit/domain/audit.types';
import { RealtimeEventsService } from '../../../realtime/application/services/realtime-events.service';
import { OperationalSanctionsService } from '../../../sanctions/application/services/operational-sanctions.service';
import { TRIPS_REPOSITORY, TripsRepository, type TripRoutePathPoint } from '../ports/trips.repository';

export type UpdateTripCommand = {
  userId: string;
  tripId: string;
  vehicleId: string;
  routeMode: TripRouteMode;
  originLabel: string;
  destinationLabel: string;
  originLatitude: number;
  originLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
  routePath?: TripRoutePathPoint[];
  routeDistanceMeters?: number;
  routeDurationSeconds?: number;
  departureAt: string;
  estimatedArrivalAt: string;
  seatCount: number;
  basePriceReference: number;
  detourSurchargeReference?: number;
  notes?: string;
};

@Injectable()
export class UpdateTripUseCase {
  constructor(
    @Inject(TRIPS_REPOSITORY)
    private readonly tripsRepository: TripsRepository,
    private readonly auditService: AuditService,
    private readonly operationalSanctionsService: OperationalSanctionsService,
    @Optional()
    private readonly realtimeEventsService: RealtimeEventsService = new RealtimeEventsService(),
  ) {}

  async execute(command: UpdateTripCommand) {
    const membership = await this.tripsRepository.findDefaultMembershipByUserId(command.userId);

    if (!membership || membership.membershipStatus !== MembershipStatus.Active) {
      throw new ForbiddenException('No tienes una membresia activa para editar viajes.');
    }

    if (membership.driverVerificationStatus !== DriverVerificationStatus.Approved) {
      throw new ForbiddenException('Solo un conductor aprobado puede editar viajes.');
    }

    if (membership.licenseStatus === DriverLicenseStatus.Expired) {
      throw new ForbiddenException(
        'Tu licencia vencio. Debes actualizarla antes de editar viajes.',
      );
    }

    await this.operationalSanctionsService.assertDriverOperationsAllowed(membership.id);

    const trip = await this.tripsRepository.findTripById(command.tripId);

    if (!trip) {
      throw new NotFoundException('El viaje solicitado no existe.');
    }

    if (trip.driverMembershipId !== membership.id) {
      throw new ForbiddenException('Solo el conductor duenio puede editar este viaje.');
    }

    if (
      trip.status === TripStatus.InProgress ||
      trip.status === TripStatus.Completed ||
      trip.status === TripStatus.Cancelled
    ) {
      throw new BadRequestException(
        'Solo puedes editar viajes que aun no hayan iniciado ni sido cerrados.',
      );
    }

    const activeRequestCount = trip.status === TripStatus.Draft
      ? 0
      : await this.tripsRepository.countActiveRequestsForTrip(trip.id);

    if (activeRequestCount > 0) {
      throw new BadRequestException(
        'No puedes editar un viaje que ya tiene solicitudes activas o pasajeros confirmados.',
      );
    }

    const vehicle = await this.tripsRepository.findVehicleByIdForMembership(
      membership.id,
      command.vehicleId,
    );

    if (!vehicle || !vehicle.isActive) {
      throw new BadRequestException('El vehiculo seleccionado no existe o no se encuentra activo.');
    }

    if (command.seatCount < 1 || command.seatCount > vehicle.seatCount) {
      throw new BadRequestException('La cantidad de cupos no puede superar la capacidad del vehiculo.');
    }

    const originLabel = command.originLabel.trim();
    const destinationLabel = command.destinationLabel.trim();

    if (!originLabel || !destinationLabel) {
      throw new BadRequestException('Debes indicar origen y destino del viaje.');
    }

    if (originLabel.localeCompare(destinationLabel, 'es', { sensitivity: 'base' }) === 0) {
      throw new BadRequestException('El origen y el destino no pueden ser iguales.');
    }

    if (
      command.originLatitude === command.destinationLatitude &&
      command.originLongitude === command.destinationLongitude
    ) {
      throw new BadRequestException('El origen y el destino no pueden compartir las mismas coordenadas.');
    }

    const departureAt = new Date(command.departureAt);
    const estimatedArrivalAt = new Date(command.estimatedArrivalAt);

    if (Number.isNaN(departureAt.getTime()) || Number.isNaN(estimatedArrivalAt.getTime())) {
      throw new BadRequestException('Las fechas del viaje no son validas.');
    }

    if (trip.status !== TripStatus.Draft && departureAt <= new Date()) {
      throw new BadRequestException('La salida del viaje debe mantenerse en el futuro.');
    }

    if (estimatedArrivalAt <= departureAt) {
      throw new BadRequestException('La llegada estimada debe ser posterior a la salida.');
    }

    if (
      command.routeMode === TripRouteMode.DirectRoute &&
      command.detourSurchargeReference &&
      command.detourSurchargeReference > 0
    ) {
      throw new BadRequestException('La ruta directa no admite recargo por desvio.');
    }

    const overlappingTrips = await this.tripsRepository.findOverlappingTrips(
      trip.driverMembershipId,
      departureAt,
      estimatedArrivalAt,
      trip.id,
    );

    if (overlappingTrips.length > 0) {
      throw new BadRequestException(
        'No puedes guardar un viaje con horario solapado respecto a otro viaje activo del mismo conductor.',
      );
    }

    const updatedTrip = await this.tripsRepository.updateTrip({
      tripId: trip.id,
      vehicleId: vehicle.id,
      routeMode: command.routeMode,
      originLabel,
      destinationLabel,
      originLatitude: command.originLatitude,
      originLongitude: command.originLongitude,
      destinationLatitude: command.destinationLatitude,
      destinationLongitude: command.destinationLongitude,
      routePath: normalizeRoutePath(command.routePath),
      routeDistanceMeters: command.routeDistanceMeters,
      routeDurationSeconds: command.routeDurationSeconds,
      departureAt,
      estimatedArrivalAt,
      seatCount: command.seatCount,
      availableSeats: command.seatCount,
      vehicleTypeSnapshot: vehicle.vehicleType,
      luggagePolicySnapshot: vehicle.luggagePolicy,
      basePriceReference: command.basePriceReference,
      detourSurchargeReference: command.detourSurchargeReference,
      notes: command.notes?.trim() || undefined,
      status: trip.status === TripStatus.Draft ? TripStatus.Draft : TripStatus.Published,
    });

    await this.auditService.record({
      institutionId: trip.institutionId,
      actorUserId: command.userId,
      action: AuditAction.TripUpdated,
      entityType: AuditEntityType.Trip,
      entityId: trip.id,
      metadata: {
        previousStatus: trip.status,
        nextStatus: updatedTrip.status,
        departureAt: updatedTrip.departureAt.toISOString(),
      },
    });

    this.realtimeEventsService.publishTripChanged({
      actorUserId: command.userId,
      institutionId: trip.institutionId,
      reason: 'updated',
      tripId: trip.id,
    });

    return {
      message: 'Viaje actualizado correctamente.',
      trip: updatedTrip,
    };
  }
}

function normalizeRoutePath(routePath: TripRoutePathPoint[] | undefined): TripRoutePathPoint[] | undefined {
  if (!routePath?.length) {
    return undefined;
  }

  return routePath
    .filter((point) =>
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude) &&
      point.latitude >= -90 &&
      point.latitude <= 90 &&
      point.longitude >= -180 &&
      point.longitude <= 180,
    )
    .slice(0, 400);
}
