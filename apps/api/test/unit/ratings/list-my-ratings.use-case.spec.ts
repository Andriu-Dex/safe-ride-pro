import { ForbiddenException } from '@nestjs/common';
import { MembershipStatus, TripStatus } from '@saferidepro/shared-types';

import { ListMyRatingsUseCase } from '../../../src/modules/ratings/application/use-cases/list-my-ratings.use-case';
import type {
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

function buildRatingRecord(overrides: Partial<RatingRecord> = {}): RatingRecord {
  return {
    id: 'rating-1',
    tripId: 'trip-1',
    institutionId: 'institution-1',
    institutionName: 'UTA',
    authorMembershipId: 'membership-passenger',
    authorUserId: 'user-passenger',
    authorFullName: 'Pasajero Uno',
    targetMembershipId: 'membership-driver',
    targetUserId: 'user-driver',
    targetFullName: 'Conductor Uno',
    tripStatus: TripStatus.Completed,
    tripOriginLabel: 'Huachi',
    tripDestinationLabel: 'Centro',
    tripDepartureAt: new Date('2030-01-01T10:00:00.000Z'),
    score: 5,
    comment: null,
    createdAt: new Date('2030-01-01T12:00:00.000Z'),
    ...overrides,
  };
}

describe('ListMyRatingsUseCase', () => {
  it('throws ForbiddenException if default membership is not found', async () => {
    const repository = createRatingsRepositoryMock();
    const useCase = new ListMyRatingsUseCase(repository);

    repository.findDefaultMembershipByUserId.mockResolvedValue(null);

    await expect(useCase.execute('user-1')).rejects.toThrow(
      new ForbiddenException('No tienes una membresia activa para consultar calificaciones.'),
    );
  });

  it('throws ForbiddenException if default membership status is not Active', async () => {
    const repository = createRatingsRepositoryMock();
    const useCase = new ListMyRatingsUseCase(repository);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      userId: 'user-1',
      fullName: 'Andrea Pasajera',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Inactive,
    });

    await expect(useCase.execute('user-1')).rejects.toThrow(
      new ForbiddenException('No tienes una membresia activa para consultar calificaciones.'),
    );
  });

  it('returns given and received ratings correctly filtered for active membership', async () => {
    const repository = createRatingsRepositoryMock();
    const useCase = new ListMyRatingsUseCase(repository);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      userId: 'user-1',
      fullName: 'Andrea Pasajera',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
    });

    const ratingGiven = buildRatingRecord({
      id: 'rating-given',
      authorMembershipId: 'membership-1',
      targetMembershipId: 'membership-driver',
    });

    const ratingReceived = buildRatingRecord({
      id: 'rating-received',
      authorMembershipId: 'membership-passenger',
      targetMembershipId: 'membership-1',
    });

    repository.listRatingsForMembershipId.mockResolvedValue([
      ratingGiven,
      ratingReceived,
    ]);

    const result = await useCase.execute('user-1');

    expect(repository.listRatingsForMembershipId).toHaveBeenCalledWith('membership-1');
    expect(result.given).toEqual([ratingGiven]);
    expect(result.received).toEqual([ratingReceived]);
  });
});
