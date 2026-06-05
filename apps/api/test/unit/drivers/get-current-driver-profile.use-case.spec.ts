import {
  DriverVerificationStatus,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';
import type {
  DriverMembershipRecord,
  DriverProfileRecord,
  DriversRepository,
} from '../../../src/modules/drivers/application/ports/drivers.repository';
import { GetCurrentDriverProfileUseCase } from '../../../src/modules/drivers/application/use-cases/get-current-driver-profile.use-case';

function createDriversRepositoryMock(): jest.Mocked<DriversRepository> {
  return {
    findDefaultMembershipByUserId: jest.fn(),
    findMembershipById: jest.fn(),
    listInstitutionAdminMembershipIds: jest.fn(),
    findDriverProfileByMembershipId: jest.fn(),
    listReviewableDriverApplications: jest.fn(),
    submitDriverApplication: jest.fn(),
    reviewDriverApplication: jest.fn(),
  };
}

describe('GetCurrentDriverProfileUseCase', () => {
  it('returns null membership and null profile if membership not found', async () => {
    const repository = createDriversRepositoryMock();
    repository.findDefaultMembershipByUserId.mockResolvedValue(null);

    const useCase = new GetCurrentDriverProfileUseCase(repository);
    const result = await useCase.execute('user-1');

    expect(repository.findDefaultMembershipByUserId).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({
      membership: null,
      driverProfile: null,
    });
  });

  it('returns membership and profile if both found', async () => {
    const repository = createDriversRepositoryMock();
    const mockMembership: DriverMembershipRecord = {
      id: 'membership-1',
      userId: 'user-1',
      institutionId: 'inst-1',
      institutionName: 'UTA',
      role: InstitutionMembershipRole.Student,
      membershipStatus: MembershipStatus.Active,
      studentCode: 'DRV001',
      isDefault: true,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    };
    const mockProfile: DriverProfileRecord = {
      membershipId: 'membership-1',
      userId: 'user-1',
      userFullName: 'Conductor Uno',
      userEmail: 'driver@uta.edu.ec',
      institutionId: 'inst-1',
      institutionName: 'UTA',
      driverVerificationStatus: DriverVerificationStatus.Approved,
      licenseType: {
        id: 'license-type-1',
        code: 'B',
        name: 'Tipo B',
      },
      licenseExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
      identityDocumentFileKey: 'drivers/identity.png',
      licenseDocumentFileKey: 'drivers/license.png',
      reviewNotes: null,
      reviewedAt: null,
      reviewedByUserId: null,
      submittedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    repository.findDefaultMembershipByUserId.mockResolvedValue(mockMembership);
    repository.findDriverProfileByMembershipId.mockResolvedValue(mockProfile);

    const useCase = new GetCurrentDriverProfileUseCase(repository);
    const result = await useCase.execute('user-1');

    expect(repository.findDefaultMembershipByUserId).toHaveBeenCalledWith('user-1');
    expect(repository.findDriverProfileByMembershipId).toHaveBeenCalledWith('membership-1');
    expect(result).toEqual({
      membership: mockMembership,
      driverProfile: mockProfile,
    });
  });
});
