import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  DriverVerificationStatus,
  MembershipStatus,
  TripRouteMode,
} from '@saferidepro/shared-types';

import { AuditService } from '../../../audit/application/services/audit.service';
import { AuditAction, AuditEntityType } from '../../../audit/domain/audit.types';
import {
  CreateTripInput,
  TRIPS_REPOSITORY,
  TripsRepository,
} from '../ports/trips.repository';

export type CreateTripCommand = Omit<
  CreateTripInput,
  | 'institutionId'
  | 'driverMembershipId'
  | 'availableSeats'
  | 'vehicleTypeSnapshot'
  | 'luggagePolicySnapshot'
  | 'departureAt'
  | 'estimatedArrivalAt'
> & {
  userId: string;
  departureAt: string;
  estimatedArrivalAt: string;
};

@Injectable()
export class CreateTripUseCase {
  constructor(
    @Inject(TRIPS_REPOSITORY)
    private readonly tripsRepository: TripsRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(command: CreateTripCommand) {
    const membership = await this.tripsRepository.findDefaultMembershipByUserId(command.userId);

    if (!membership || membership.membershipStatus !== MembershipStatus.Active) {
      throw new ForbiddenException('No tienes una membresia activa para crear viajes.');
    }

    if (membership.driverVerificationStatus !== DriverVerificationStatus.Approved) {
      throw new ForbiddenException('Solo un conductor aprobado puede crear viajes.');
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

    const departureAt = new Date(command.departureAt);
    const estimatedArrivalAt = new Date(command.estimatedArrivalAt);

    if (Number.isNaN(departureAt.getTime()) || Number.isNaN(estimatedArrivalAt.getTime())) {
      throw new BadRequestException('Las fechas del viaje no son validas.');
    }

    if (departureAt <= new Date()) {
      throw new BadRequestException('La salida del viaje debe estar en el futuro.');
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

    const trip = await this.tripsRepository.createTrip({
      institutionId: membership.institutionId,
      driverMembershipId: membership.id,
      vehicleId: vehicle.id,
      routeMode: command.routeMode,
      originLabel: command.originLabel.trim(),
      destinationLabel: command.destinationLabel.trim(),
      originLatitude: command.originLatitude,
      originLongitude: command.originLongitude,
      destinationLatitude: command.destinationLatitude,
      destinationLongitude: command.destinationLongitude,
      departureAt,
      estimatedArrivalAt,
      seatCount: command.seatCount,
      availableSeats: command.seatCount,
      vehicleTypeSnapshot: vehicle.vehicleType,
      luggagePolicySnapshot: vehicle.luggagePolicy,
      basePriceReference: command.basePriceReference,
      detourSurchargeReference: command.detourSurchargeReference,
      notes: command.notes?.trim() || undefined,
    });

    await this.auditService.record({
      institutionId: membership.institutionId,
      actorUserId: command.userId,
      action: AuditAction.TripCreated,
      entityType: AuditEntityType.Trip,
      entityId: trip.id,
      metadata: {
        routeMode: trip.routeMode,
        departureAt: trip.departureAt.toISOString(),
      },
    });

    return {
      message: 'Viaje creado en borrador correctamente.',
      trip,
    };
  }
}