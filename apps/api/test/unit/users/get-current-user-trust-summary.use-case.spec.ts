import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AccountStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
  UserOnboardingStatus,
} from '@saferidepro/shared-types';

import { OperationalSanctionsService } from '../../../src/modules/sanctions/application/services/operational-sanctions.service';
import { GetCurrentUserTrustSummaryUseCase } from '../../../src/modules/users/application/use-cases/get-current-user-trust-summary.use-case';
import type {
  TrustSummaryMetrics,
  UserProfile,
  UsersRepository,
} from '../../../src/modules/users/application/ports/users.repository';

function createUsersRepositoryMock(): jest.Mocked<UsersRepository> {
  return {
    findById: jest.fn(),
    findProfilePhotoRecordById: jest.fn(),
    updateProfile: jest.fn(),
    updateAccountStatus: jest.fn(),
    updateProfilePhoto: jest.fn(),
    getTrustSummary: jest.fn(),
    listAdminUserDirectory: jest.fn(),
  };
}

function createOperationalSanctionsServiceMock(): jest.Mocked<OperationalSanctionsService> {
  return {
    synchronizeAutomaticSanctions: jest.fn(),
    getRecentSanctionHistory: jest.fn(),
    assertPassengerOperationsAllowed: jest.fn(),
    assertDriverOperationsAllowed: jest.fn(),
  } as unknown as jest.Mocked<OperationalSanctionsService>;
}

function buildUserProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    email: 'user@uta.edu.ec',
    fullName: 'Usuario Uno',
    career: null,
    phone: null,
    referenceNeighborhood: null,
    documentType: 'NATIONAL_ID',
    documentNumber: '1234567890',
    profilePhotoUrl: null,
    globalRole: GlobalUserRole.User,
    accountStatus: AccountStatus.Active,
    emailVerifiedAt: new Date('2030-01-01T09:00:00.000Z'),
    termsAcceptedAt: null,
    privacyAcceptedAt: null,
    safetyRulesAcceptedAt: null,
    onboardingCompletedAt: null,
    onboardingStatus: UserOnboardingStatus.Incomplete,
    missingOnboardingRequirements: [],
    requiresOnboarding: true,
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

function buildTrustSummary(): TrustSummaryMetrics {
  return {
    membershipId: 'membership-1',
    averageRatingReceived: 4.5,
    totalRatingsReceived: 2,
    completedTripsAsDriver: 1,
    completedTripsAsPassenger: 2,
    lateDriverTripCancellations: 0,
    latePassengerTripRequestCancellations: 0,
    passengerNoShows: 0,
    resolvedReportsReceived: 0,
    resolvedLowSeverityReportsReceived: 0,
    resolvedMediumSeverityReportsReceived: 0,
    resolvedHighSeverityReportsReceived: 0,
    cancellationPolicy: {
      lateWindowMinutes: 30,
      lastComputedAt: new Date('2030-01-01T12:00:00.000Z'),
    },
  };
}

describe('GetCurrentUserTrustSummaryUseCase', () => {
  it('returns the summary for the active default membership', async () => {
    const repository = createUsersRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new GetCurrentUserTrustSummaryUseCase(repository, sanctionsService);

    repository.findById.mockResolvedValue(buildUserProfile());
    repository.getTrustSummary.mockResolvedValue(buildTrustSummary());
    sanctionsService.synchronizeAutomaticSanctions.mockResolvedValue([]);
    sanctionsService.getRecentSanctionHistory.mockResolvedValue({
      recentSanctionCount: 0,
      recentBlockingSanctionCount: 0,
      recurrenceWindowDays: 90,
      lastComputedAt: new Date('2030-01-01T12:00:00.000Z'),
    });

    const response = await useCase.execute('user-1');

    expect(response.membershipId).toBe('membership-1');
    expect(response.visibleReputationState).toBe('IN_CONSTRUCTION');
    expect(response.administrativeRiskState).toBe('NORMAL');
    expect(repository.getTrustSummary).toHaveBeenCalledWith('membership-1');
    expect(sanctionsService.synchronizeAutomaticSanctions).toHaveBeenCalledWith('membership-1');
    expect(sanctionsService.getRecentSanctionHistory).toHaveBeenCalledWith('membership-1');
  });

  it('rejects missing users or users without an active membership', async () => {
    const repository = createUsersRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new GetCurrentUserTrustSummaryUseCase(repository, sanctionsService);

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

  it('marks the summary under review when low ratings and recent risks coexist', async () => {
    const repository = createUsersRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new GetCurrentUserTrustSummaryUseCase(repository, sanctionsService);

    repository.findById.mockResolvedValue(buildUserProfile());
    repository.getTrustSummary.mockResolvedValue({
      ...buildTrustSummary(),
      averageRatingReceived: 3.2,
      totalRatingsReceived: 4,
      completedTripsAsDriver: 3,
      completedTripsAsPassenger: 2,
      latePassengerTripRequestCancellations: 1,
    });
    sanctionsService.synchronizeAutomaticSanctions.mockResolvedValue([]);
    sanctionsService.getRecentSanctionHistory.mockResolvedValue({
      recentSanctionCount: 1,
      recentBlockingSanctionCount: 0,
      recurrenceWindowDays: 90,
      lastComputedAt: new Date('2030-01-01T12:00:00.000Z'),
    });

    const response = await useCase.execute('user-1');

    expect(response.hasEnoughRatingsSignal).toBe(true);
    expect(response.hasLowRatingSignal).toBe(true);
    expect(response.visibleReputationState).toBe('UNDER_REVIEW');
    expect(response.administrativeRiskState).toBe('UNDER_REVIEW');
    expect(response.riskSignals).toContain(
      'Tu promedio reciente de calificaciones esta por debajo de 3.5/5 con muestra suficiente.',
    );
  });

  it('marks the summary under review when there is a recent high-severity resolved report', async () => {
    const repository = createUsersRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new GetCurrentUserTrustSummaryUseCase(repository, sanctionsService);

    repository.findById.mockResolvedValue(buildUserProfile());
    repository.getTrustSummary.mockResolvedValue({
      ...buildTrustSummary(),
      resolvedReportsReceived: 1,
      resolvedHighSeverityReportsReceived: 1,
    });
    sanctionsService.synchronizeAutomaticSanctions.mockResolvedValue([]);
    sanctionsService.getRecentSanctionHistory.mockResolvedValue({
      recentSanctionCount: 0,
      recentBlockingSanctionCount: 0,
      recurrenceWindowDays: 90,
      lastComputedAt: new Date('2030-01-01T12:00:00.000Z'),
    });

    const response = await useCase.execute('user-1');

    expect(response.administrativeRiskState).toBe('UNDER_REVIEW');
    expect(response.visibleReputationState).toBe('UNDER_REVIEW');
    expect(response.riskSignals).toContain(
      'Existe al menos un reporte resuelto reciente de alta severidad (1) que requiere seguimiento prioritario.',
    );
  });

  it('maps active sanctions in the output', async () => {
    const repository = createUsersRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new GetCurrentUserTrustSummaryUseCase(repository, sanctionsService);

    repository.findById.mockResolvedValue(buildUserProfile());
    repository.getTrustSummary.mockResolvedValue(buildTrustSummary());
    sanctionsService.synchronizeAutomaticSanctions.mockResolvedValue([
      {
        id: 'sanction-1',
        type: 'SUSPENSION' as any,
        scope: 'GLOBAL' as any,
        reason: 'Violation',
        createdAt: new Date(),
        expiresAt: new Date(),
        liftedAt: null,
      } as any,
    ]);
    sanctionsService.getRecentSanctionHistory.mockResolvedValue({
      recentSanctionCount: 0,
      recentBlockingSanctionCount: 0,
      recurrenceWindowDays: 90,
      lastComputedAt: new Date('2030-01-01T12:00:00.000Z'),
    });

    const response = await useCase.execute('user-1');

    expect(response.activeSanctions).toHaveLength(1);
    expect(response.activeSanctions[0]).toEqual(
      expect.objectContaining({
        type: 'SUSPENSION',
        scope: 'GLOBAL',
      }),
    );
  });
});
