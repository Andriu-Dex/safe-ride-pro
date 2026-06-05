import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
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
      completedAt: new Date('2030-01-01T10:40:00.000Z'),
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
      completedAt: new Date('2030-01-01T10:40:00.000Z'),
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
        completedAt: new Date('2030-01-01T10:40:00.000Z'),
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

  it('throws ForbiddenException if author default membership is not found', async () => {
    const repository = createRatingsRepositoryMock();
    const useCase = new CreateRatingUseCase(repository);
    repository.findDefaultMembershipByUserId.mockResolvedValue(null);

    await expect(
      useCase.execute({
        userId: 'user-passenger',
        tripId: 'trip-1',
        targetMembershipId: 'membership-driver',
        score: 5,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException if trip is not found', async () => {
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
    repository.findTripById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        userId: 'user-passenger',
        tripId: 'trip-1',
        targetMembershipId: 'membership-driver',
        score: 5,
      }),
    ).rejects.toThrow(new NotFoundException('El viaje indicado no existe.'));
  });

  it('throws ForbiddenException if trip institutionId does not match author membership institutionId', async () => {
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
      institutionId: 'institution-different',
      institutionName: 'Different Inst',
      status: TripStatus.Completed,
      driverMembershipId: 'membership-driver',
      driverUserId: 'user-driver',
      driverFullName: 'Conductor Uno',
      originLabel: 'Huachi',
      destinationLabel: 'Centro',
      departureAt: new Date('2030-01-01T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
      completedAt: new Date('2030-01-01T10:40:00.000Z'),
      cancelledAt: null,
    });

    await expect(
      useCase.execute({
        userId: 'user-passenger',
        tripId: 'trip-1',
        targetMembershipId: 'membership-driver',
        score: 5,
      }),
    ).rejects.toThrow(new ForbiddenException('Solo puedes calificar viajes de tu institucion activa.'));
  });

  it('throws BadRequestException if user attempts self-rating', async () => {
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
      completedAt: new Date('2030-01-01T10:40:00.000Z'),
      cancelledAt: null,
    });

    await expect(
      useCase.execute({
        userId: 'user-passenger',
        tripId: 'trip-1',
        targetMembershipId: 'membership-passenger',
        score: 5,
      }),
    ).rejects.toThrow(new BadRequestException('No puedes calificarte a ti mismo.'));
  });

  it('throws ForbiddenException if user did not participate in the trip', async () => {
    const repository = createRatingsRepositoryMock();
    const useCase = new CreateRatingUseCase(repository);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-stranger',
      userId: 'user-stranger',
      fullName: 'Stranger',
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
      completedAt: new Date('2030-01-01T10:40:00.000Z'),
      cancelledAt: null,
    });
    repository.hasAcceptedTripRequest.mockResolvedValue(false);

    await expect(
      useCase.execute({
        userId: 'user-stranger',
        tripId: 'trip-1',
        targetMembershipId: 'membership-driver',
        score: 5,
      }),
    ).rejects.toThrow(new ForbiddenException('No participaste en este viaje como conductor o pasajero confirmado.'));
  });

  it('throws BadRequestException if driver tries to rate a non-passenger', async () => {
    const repository = createRatingsRepositoryMock();
    const useCase = new CreateRatingUseCase(repository);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-driver',
      userId: 'user-driver',
      fullName: 'Conductor Uno',
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
      completedAt: new Date('2030-01-01T10:40:00.000Z'),
      cancelledAt: null,
    });
    // Author is driver (isDriver = true), so check targetIsAcceptedPassenger
    repository.hasAcceptedTripRequest.mockResolvedValue(false);

    await expect(
      useCase.execute({
        userId: 'user-driver',
        tripId: 'trip-1',
        targetMembershipId: 'membership-nonpassenger',
        score: 5,
      }),
    ).rejects.toThrow(new BadRequestException('Solo puedes calificar a pasajeros confirmados de este viaje.'));
  });

  it('throws BadRequestException if passenger tries to rate another passenger instead of the driver', async () => {
    const repository = createRatingsRepositoryMock();
    const useCase = new CreateRatingUseCase(repository);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-passenger-1',
      userId: 'user-passenger-1',
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
      completedAt: new Date('2030-01-01T10:40:00.000Z'),
      cancelledAt: null,
    });
    // isDriver = false, targetMembershipId !== trip.driverMembershipId
    repository.hasAcceptedTripRequest.mockResolvedValue(true);

    await expect(
      useCase.execute({
        userId: 'user-passenger-1',
        tripId: 'trip-1',
        targetMembershipId: 'membership-passenger-2',
        score: 5,
      }),
    ).rejects.toThrow(new BadRequestException('Como pasajero solo puedes calificar al conductor del viaje.'));
  });
});
