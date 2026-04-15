import { BadRequestException } from '@nestjs/common';
import {
  MembershipStatus,
  TripStatus,
} from '@saferidepro/shared-types';

import { CreateRatingUseCase } from '../../../src/modules/ratings/application/use-cases/create-rating.use-case';
import type {
  CreateRatingInput,
  RatingRecord,
  RatingsRepository,
} from '../../../src/modules/ratings/application/ports/ratings.repository';

function createRatingsRepositoryMock(): jest.Mocked<RatingsRepository> {
  return {
    findDefaultMembershipByUserId: jest.fn(),
    findTripById: jest.fn(),
    hasAcceptedTripRequest: jest.fn(),
    findRatingByTripAuthorAndTarget: jest.fn(),
    createRating: jest.fn(),
    listRatingsForMembershipId: jest.fn(),
  };
}

function buildCreatedRating(input: CreateRatingInput): RatingRecord {
  return {
    id: 'rating-1',
    tripId: input.tripId,
    institutionId: 'institution-1',
    institutionName: 'UTA',
    authorMembershipId: input.authorMembershipId,
    authorUserId: 'user-passenger',
    authorFullName: 'Pasajero Uno',
    targetMembershipId: input.targetMembershipId,
    targetUserId: 'user-driver',
    targetFullName: 'Conductor Uno',
    tripStatus: TripStatus.Completed,
    tripOriginLabel: 'Huachi',
    tripDestinationLabel: 'Centro',
    tripDepartureAt: new Date('2030-01-01T10:00:00.000Z'),
    score: input.score,
    comment: input.comment ?? null,
    createdAt: new Date('2030-01-01T12:00:00.000Z'),
  };
}

describe('CreateRatingUseCase', () => {
  it('creates a rating when an accepted passenger rates the trip driver', async () => {
    const repository = createRatingsRepositoryMock();
    const useCase = new CreateRatingUseCase(repository);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-passenger',
      userId: 'user-passenger',
      fullName: 'Pasajero Uno',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
    });
    repository.findTripById.mockResolvedValue({
      id: 'trip-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      status: TripStatus.Completed,
      driverMembershipId: 'membership-driver',
      driverUserId: 'user-driver',
      driverFullName: 'Conductor Uno',
      originLabel: 'Huachi',
      destinationLabel: 'Centro',
      departureAt: new Date('2030-01-01T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
      cancelledAt: null,
    });
    repository.hasAcceptedTripRequest.mockResolvedValue(true);
    repository.findRatingByTripAuthorAndTarget.mockResolvedValue(null);
    repository.createRating.mockImplementation(async (input) => buildCreatedRating(input));

    const response = await useCase.execute({
      userId: 'user-passenger',
      tripId: 'trip-1',
      targetMembershipId: 'membership-driver',
      score: 5,
      comment: '  Excelente servicio  ',
    });

    expect(response.message).toBe('Calificacion registrada correctamente.');
    expect(repository.createRating).toHaveBeenCalledWith({
      tripId: 'trip-1',
      authorMembershipId: 'membership-passenger',
      targetMembershipId: 'membership-driver',
      score: 5,
      comment: 'Excelente servicio',
    });
  });

  it('rejects a duplicate rating for the same trip and relationship', async () => {
    const repository = createRatingsRepositoryMock();
    const useCase = new CreateRatingUseCase(repository);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-passenger',
      userId: 'user-passenger',
      fullName: 'Pasajero Uno',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
    });
    repository.findTripById.mockResolvedValue({
      id: 'trip-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      status: TripStatus.Completed,
      driverMembershipId: 'membership-driver',
      driverUserId: 'user-driver',
      driverFullName: 'Conductor Uno',
      originLabel: 'Huachi',
      destinationLabel: 'Centro',
      departureAt: new Date('2030-01-01T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
      cancelledAt: null,
    });
    repository.hasAcceptedTripRequest.mockResolvedValue(true);
    repository.findRatingByTripAuthorAndTarget.mockResolvedValue(
      buildCreatedRating({
        tripId: 'trip-1',
        authorMembershipId: 'membership-passenger',
        targetMembershipId: 'membership-driver',
        score: 5,
      }),
    );

    await expect(
      useCase.execute({
        userId: 'user-passenger',
        tripId: 'trip-1',
        targetMembershipId: 'membership-driver',
        score: 4,
      }),
    ).rejects.toThrow(
      new BadRequestException('Ya registraste una calificacion para esta relacion en el viaje.'),
    );

    expect(repository.createRating).not.toHaveBeenCalled();
  });

  it('rejects ratings outside the post-trip closure window', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2030-01-05T12:00:00.000Z'));

    try {
      const repository = createRatingsRepositoryMock();
      const useCase = new CreateRatingUseCase(repository);

      repository.findDefaultMembershipByUserId.mockResolvedValue({
        id: 'membership-passenger',
        userId: 'user-passenger',
        fullName: 'Pasajero Uno',
        institutionId: 'institution-1',
        institutionName: 'UTA',
        membershipStatus: MembershipStatus.Active,
      });
      repository.findTripById.mockResolvedValue({
        id: 'trip-1',
        institutionId: 'institution-1',
        institutionName: 'UTA',
        status: TripStatus.Completed,
        driverMembershipId: 'membership-driver',
        driverUserId: 'user-driver',
        driverFullName: 'Conductor Uno',
        originLabel: 'Huachi',
        destinationLabel: 'Centro',
        departureAt: new Date('2030-01-01T10:00:00.000Z'),
        estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
        cancelledAt: null,
      });

      await expect(
        useCase.execute({
          userId: 'user-passenger',
          tripId: 'trip-1',
          targetMembershipId: 'membership-driver',
          score: 4,
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'Solo puedes calificar viajes completados dentro de la ventana de cierre.',
        ),
      );

      expect(repository.createRating).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
