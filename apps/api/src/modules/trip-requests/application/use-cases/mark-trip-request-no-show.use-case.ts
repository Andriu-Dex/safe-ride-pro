import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TripRequestStatus, TripStatus } from '@saferidepro/shared-types';

import {
  TRIP_REQUESTS_REPOSITORY,
  TripRequestsRepository,
} from '../ports/trip-requests.repository';

@Injectable()
export class MarkTripRequestNoShowUseCase {
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
      throw new ForbiddenException('Solo el conductor del viaje puede registrar un no-show.');
    }

    if (tripRequest.status !== TripRequestStatus.Accepted) {
      throw new BadRequestException(
        'Solo las solicitudes aceptadas pueden marcarse como no-show.',
      );
    }

    if (
      tripRequest.tripStatus !== TripStatus.InProgress &&
      tripRequest.tripStatus !== TripStatus.Completed
    ) {
      throw new BadRequestException(
        'Solo puedes marcar no-show cuando el viaje ya inicio o finalizo.',
      );
    }

    const normalizedReviewNote = reviewNote?.trim();

    if (!normalizedReviewNote) {
      throw new BadRequestException('Debes indicar una nota para registrar el no-show.');
    }

    const updatedTripRequest = await this.tripRequestsRepository.markTripRequestAsNoShow(
      requestId,
      normalizedReviewNote,
    );

    if (!updatedTripRequest) {
      throw new BadRequestException(
        'La solicitud ya no pudo marcarse como no-show por un cambio reciente en su estado.',
      );
    }

    return {
      message: 'No-show registrado correctamente.',
      tripRequest: updatedTripRequest,
    };
  }
}
