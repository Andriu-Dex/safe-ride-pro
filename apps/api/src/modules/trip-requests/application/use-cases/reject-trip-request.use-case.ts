import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TripRequestStatus } from '@saferidepro/shared-types';

import {
  TRIP_REQUESTS_REPOSITORY,
  TripRequestsRepository,
} from '../ports/trip-requests.repository';

@Injectable()
export class RejectTripRequestUseCase {
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
      throw new ForbiddenException('Solo el conductor del viaje puede rechazar esta solicitud.');
    }

    if (tripRequest.status !== TripRequestStatus.Pending) {
      throw new BadRequestException('Solo las solicitudes pendientes pueden rechazarse.');
    }

    const updatedTripRequest = await this.tripRequestsRepository.rejectTripRequest(
      requestId,
      reviewNote?.trim() || undefined,
    );

    if (!updatedTripRequest) {
      throw new BadRequestException(
        'La solicitud ya no pudo rechazarse por un cambio reciente en su estado.',
      );
    }

    return {
      message: 'Solicitud rechazada correctamente.',
      tripRequest: updatedTripRequest,
    };
  }
}
