import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  canCreateTripRating,
  MembershipStatus,
} from '@saferidepro/shared-types';

import {
  RATINGS_REPOSITORY,
  RatingsRepository,
} from '../ports/ratings.repository';

export type CreateRatingCommand = {
  userId: string;
  tripId: string;
  targetMembershipId: string;
  score: number;
  comment?: string;
};

@Injectable()
export class CreateRatingUseCase {
  constructor(
    @Inject(RATINGS_REPOSITORY)
    private readonly ratingsRepository: RatingsRepository,
  ) {}

  async execute(command: CreateRatingCommand) {
    const membership = await this.ratingsRepository.findDefaultMembershipByUserId(command.userId);

    if (!membership || membership.membershipStatus !== MembershipStatus.Active) {
      throw new ForbiddenException('No tienes una membresia activa para registrar calificaciones.');
    }

    const trip = await this.ratingsRepository.findTripById(command.tripId);

    if (!trip) {
      throw new NotFoundException('El viaje indicado no existe.');
    }

    if (trip.institutionId !== membership.institutionId) {
      throw new ForbiddenException('Solo puedes calificar viajes de tu institucion activa.');
    }

    if (
      !canCreateTripRating({
        status: trip.status,
        departureAt: trip.departureAt,
        estimatedArrivalAt: trip.estimatedArrivalAt,
      })
    ) {
      throw new BadRequestException(
        'Solo puedes calificar viajes completados dentro de la ventana de cierre.',
      );
    }

    if (command.targetMembershipId === membership.id) {
      throw new BadRequestException('No puedes calificarte a ti mismo.');
    }

    const isDriver = trip.driverMembershipId === membership.id;
    const isAcceptedPassenger = await this.ratingsRepository.hasAcceptedTripRequest(
      trip.id,
      membership.id,
    );

    if (!isDriver && !isAcceptedPassenger) {
      throw new ForbiddenException('No participaste en este viaje como conductor o pasajero confirmado.');
    }

    if (isDriver) {
      const targetIsAcceptedPassenger = await this.ratingsRepository.hasAcceptedTripRequest(
        trip.id,
        command.targetMembershipId,
      );

      if (!targetIsAcceptedPassenger) {
        throw new BadRequestException('Solo puedes calificar a pasajeros confirmados de este viaje.');
      }
    } else if (command.targetMembershipId !== trip.driverMembershipId) {
      throw new BadRequestException('Como pasajero solo puedes calificar al conductor del viaje.');
    }

    const existingRating = await this.ratingsRepository.findRatingByTripAuthorAndTarget(
      trip.id,
      membership.id,
      command.targetMembershipId,
    );

    if (existingRating) {
      throw new BadRequestException('Ya registraste una calificacion para esta relacion en el viaje.');
    }

    const rating = await this.ratingsRepository.createRating({
      tripId: trip.id,
      authorMembershipId: membership.id,
      targetMembershipId: command.targetMembershipId,
      score: command.score,
      comment: command.comment?.trim() || undefined,
    });

    return {
      message: 'Calificacion registrada correctamente.',
      rating,
    };
  }
}
