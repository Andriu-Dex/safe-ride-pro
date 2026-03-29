import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  TripRequestStatus,
  TripStatus,
} from '@saferidepro/shared-types';

import {
  TRIP_REQUESTS_REPOSITORY,
  TripRequestsRepository,
} from '../ports/trip-requests.repository';

@Injectable()
export class AcceptTripRequestUseCase {
  constructor(
    @Inject(TRIP_REQUESTS_REPOSITORY)
    private readonly tripRequestsRepository: TripRequestsRepository,
  ) {}

  async execute(userId: string, requestId: string, reviewNote?: string) {
    const tripRequest = await this.tripRequestsRepository.findTripRequestById(requestId);

    if (!tripRequest) {
      throw new NotFoundException('La solicitud de viaje no existe.');
    }

    if (tripRequest.driverUserId !== userId) {
      throw new ForbiddenException('Solo el conductor del viaje puede aceptar esta solicitud.');
    }

    if (tripRequest.status !== TripRequestStatus.Pending) {
      throw new BadRequestException('Solo las solicitudes pendientes pueden aceptarse.');
    }

    if (tripRequest.tripStatus !== TripStatus.Published) {
      throw new BadRequestException(
        'La solicitud ya no puede aceptarse porque el viaje cambio de estado.',
      );
    }

    if (tripRequest.tripAvailableSeats < 1) {
      throw new BadRequestException('El viaje ya no tiene cupos disponibles.');
    }

    const updatedTripRequest = await this.tripRequestsRepository.acceptTripRequest(
      requestId,
      reviewNote?.trim() || undefined,
    );

    if (!updatedTripRequest) {
      throw new BadRequestException(
        'La solicitud ya no pudo aceptarse porque el viaje cambio de estado.',
      );
    }

    return {
      message: 'Solicitud aceptada correctamente.',
      tripRequest: updatedTripRequest,
    };
  }
}
