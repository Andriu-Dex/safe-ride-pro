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
export class CancelTripRequestUseCase {
  constructor(
    @Inject(TRIP_REQUESTS_REPOSITORY)
    private readonly tripRequestsRepository: TripRequestsRepository,
  ) {}

  async execute(userId: string, requestId: string) {
    const tripRequest = await this.tripRequestsRepository.findTripRequestById(requestId);

    if (!tripRequest) {
      throw new NotFoundException('La solicitud de viaje no existe.');
    }

    if (tripRequest.passengerUserId !== userId) {
      throw new ForbiddenException('Solo el pasajero de la solicitud puede cancelarla.');
    }

    if (
      tripRequest.status !== TripRequestStatus.Pending &&
      tripRequest.status !== TripRequestStatus.Accepted
    ) {
      throw new BadRequestException('Solo las solicitudes pendientes o aceptadas pueden cancelarse.');
    }

    if (
      tripRequest.tripStatus !== TripStatus.Published &&
      tripRequest.tripStatus !== TripStatus.Full
    ) {
      throw new BadRequestException(
        'La solicitud ya no puede cancelarse porque el viaje cambio de estado.',
      );
    }

    const updatedTripRequest = await this.tripRequestsRepository.cancelTripRequest(requestId);

    if (!updatedTripRequest) {
      throw new BadRequestException(
        'La solicitud ya no pudo cancelarse por un cambio reciente en su estado.',
      );
    }

    return {
      message: 'Solicitud cancelada correctamente.',
      tripRequest: updatedTripRequest,
    };
  }
}
