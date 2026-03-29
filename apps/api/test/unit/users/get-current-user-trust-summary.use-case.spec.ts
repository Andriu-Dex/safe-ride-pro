import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AccountStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

import { GetCurrentUserTrustSummaryUseCase } from '../../../src/modules/users/application/use-cases/get-current-user-trust-summary.use-case';
import type {
  TrustSummary,
  UserProfile,
  UsersRepository,
} from '../../../src/modules/users/application/ports/users.repository';

function createUsersRepositoryMock(): jest.Mocked<UsersRepository> {
  return {
    findById: jest.fn(),
    updateProfile: jest.fn(),
    getTrustSummary: jest.fn(),
  };
}

function buildUserProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    email: 'user@uta.edu.ec',
    fullName: 'Usuario Uno',
    phone: null,
    documentType: 'NATIONAL_ID',
    documentNumber: '1234567890',
    profilePhotoUrl: null,
    globalRole: GlobalUserRole.User,
    accountStatus: AccountStatus.Active,
    emailVerifiedAt: new Date('2030-01-01T09:00:00.000Z'),
    memberships: [
      {
        id: 'membership-1',
        institutionId: 'institution-1',
        institutionName: 'UTA',
        role: InstitutionMembershipRole.Student,
        membershipStatus: MembershipStatus.Active,
        studentCode: 'STU-001',
        isDefault: true,
        driverVerificationStatus: DriverVerificationStatus.NotRequested,
      },
    ],
    ...overrides,
  };
}

function buildTrustSummary(): TrustSummary {
  return {
    membershipId: 'membership-1',
    averageRatingReceived: 4.5,
    totalRatingsReceived: 4,
    completedTripsAsDriver: 2,
    completedTripsAsPassenger: 3,
    lateDriverTripCancellations: 1,
    latePassengerTripRequestCancellations: 1,
    passengerNoShows: 0,
    resolvedReportsReceived: 1,
    cancellationPolicy: {
      lateWindowMinutes: 30,
      lastComputedAt: new Date('2030-01-01T12:00:00.000Z'),
    },
  };
}

describe('GetCurrentUserTrustSummaryUseCase', () => {
  it('returns the summary for the active default membership', async () => {
    const repository = createUsersRepositoryMock();
    const useCase = new GetCurrentUserTrustSummaryUseCase(repository);

    repository.findById.mockResolvedValue(buildUserProfile());
    repository.getTrustSummary.mockResolvedValue(buildTrustSummary());

    const response = await useCase.execute('user-1');

    expect(response.membershipId).toBe('membership-1');
    expect(repository.getTrustSummary).toHaveBeenCalledWith('membership-1');
  });

  it('rejects missing users or users without an active membership', async () => {
    const repository = createUsersRepositoryMock();
    const useCase = new GetCurrentUserTrustSummaryUseCase(repository);

    repository.findById
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        buildUserProfile({
          memberships: [
            {
              ...buildUserProfile().memberships[0],
              membershipStatus: MembershipStatus.Inactive,
            },
          ],
        }),
      );

    await expect(useCase.execute('user-1')).rejects.toThrow(
      new NotFoundException('El usuario solicitado no existe.'),
    );

    await expect(useCase.execute('user-1')).rejects.toThrow(
      new ForbiddenException(
        'No tienes una membresia activa para consultar tu resumen de confianza.',
      ),
    );
  });
});
