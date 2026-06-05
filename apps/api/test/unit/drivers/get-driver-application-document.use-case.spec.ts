import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AccountStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

import type { CurrentUserContext } from '../../../src/modules/auth/application/types/current-user-context.type';
import type {
  DriverDocumentStorageService,
  RetrievedDriverDocument,
} from '../../../src/modules/drivers/application/ports/driver-document-storage.service';
import {
  DriverDocumentType,
  DriverMembershipRecord,
  DriverProfileRecord,
  DriversRepository,
} from '../../../src/modules/drivers/application/ports/drivers.repository';
import { GetDriverApplicationDocumentUseCase } from '../../../src/modules/drivers/application/use-cases/get-driver-application-document.use-case';

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

function createDriverDocumentStorageServiceMock(): jest.Mocked<DriverDocumentStorageService> {
  return {
    readDocument: jest.fn(),
    storeDocument: jest.fn(),
  };
}

function buildCurrentUser(overrides: Partial<CurrentUserContext> = {}): CurrentUserContext {
  return {
    id: 'user-1',
    email: 'user@uta.edu.ec',
    fullName: 'Test User',
    globalRole: GlobalUserRole.User,
    accountStatus: AccountStatus.Active,
    memberships: [],
    ...overrides,
  };
}

describe('GetDriverApplicationDocumentUseCase', () => {
  it('throws NotFoundException if membership is not found', async () => {
    const repository = createDriversRepositoryMock();
    const storageService = createDriverDocumentStorageServiceMock();
    repository.findMembershipById.mockResolvedValue(null);

    const useCase = new GetDriverApplicationDocumentUseCase(repository, storageService);

    await expect(
      useCase.execute(buildCurrentUser(), 'membership-1', DriverDocumentType.Identity),
    ).rejects.toThrow(new NotFoundException('La solicitud de conductor no existe.'));
  });

  it('throws ForbiddenException if user cannot access the document', async () => {
    const repository = createDriversRepositoryMock();
    const storageService = createDriverDocumentStorageServiceMock();
    const membership: DriverMembershipRecord = {
      id: 'membership-1',
      userId: 'user-other',
      institutionId: 'inst-1',
      institutionName: 'UTA',
      role: InstitutionMembershipRole.Student,
      membershipStatus: MembershipStatus.Active,
      studentCode: 'DRV001',
      isDefault: true,
      driverVerificationStatus: DriverVerificationStatus.PendingVerification,
    };
    repository.findMembershipById.mockResolvedValue(membership);

    const useCase = new GetDriverApplicationDocumentUseCase(repository, storageService);

    await expect(
      useCase.execute(
        buildCurrentUser({ id: 'user-1', globalRole: GlobalUserRole.User, memberships: [] }),
        'membership-1',
        DriverDocumentType.Identity,
      ),
    ).rejects.toThrow(new ForbiddenException('No tienes permisos para acceder a este documento.'));
  });

  it('throws NotFoundException if driver profile is not found', async () => {
    const repository = createDriversRepositoryMock();
    const storageService = createDriverDocumentStorageServiceMock();
    const membership: DriverMembershipRecord = {
      id: 'membership-1',
      userId: 'user-1',
      institutionId: 'inst-1',
      institutionName: 'UTA',
      role: InstitutionMembershipRole.Student,
      membershipStatus: MembershipStatus.Active,
      studentCode: 'DRV001',
      isDefault: true,
      driverVerificationStatus: DriverVerificationStatus.PendingVerification,
    };
    repository.findMembershipById.mockResolvedValue(membership);
    repository.findDriverProfileByMembershipId.mockResolvedValue(null);

    const useCase = new GetDriverApplicationDocumentUseCase(repository, storageService);

    await expect(
      useCase.execute(buildCurrentUser({ id: 'user-1' }), 'membership-1', DriverDocumentType.Identity),
    ).rejects.toThrow(new NotFoundException('La solicitud de conductor aun no ha sido enviada.'));
  });

  it('throws NotFoundException if file key is missing for requested document type', async () => {
    const repository = createDriversRepositoryMock();
    const storageService = createDriverDocumentStorageServiceMock();
    const membership: DriverMembershipRecord = {
      id: 'membership-1',
      userId: 'user-1',
      institutionId: 'inst-1',
      institutionName: 'UTA',
      role: InstitutionMembershipRole.Student,
      membershipStatus: MembershipStatus.Active,
      studentCode: 'DRV001',
      isDefault: true,
      driverVerificationStatus: DriverVerificationStatus.PendingVerification,
    };
    const profile: DriverProfileRecord = {
      membershipId: 'membership-1',
      userId: 'user-1',
      userFullName: 'Conductor Uno',
      userEmail: 'driver@uta.edu.ec',
      institutionId: 'inst-1',
      institutionName: 'UTA',
      driverVerificationStatus: DriverVerificationStatus.PendingVerification,
      licenseType: {
        id: 'license-type-1',
        code: 'B',
        name: 'Tipo B',
      },
      licenseExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
      identityDocumentFileKey: null,
      licenseDocumentFileKey: 'license-key',
      reviewNotes: null,
      reviewedAt: null,
      reviewedByUserId: null,
      submittedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    repository.findMembershipById.mockResolvedValue(membership);
    repository.findDriverProfileByMembershipId.mockResolvedValue(profile);

    const useCase = new GetDriverApplicationDocumentUseCase(repository, storageService);

    await expect(
      useCase.execute(buildCurrentUser({ id: 'user-1' }), 'membership-1', DriverDocumentType.Identity),
    ).rejects.toThrow(new NotFoundException('El documento solicitado no existe.'));
  });

  it('successfully returns document read result if authorized', async () => {
    const repository = createDriversRepositoryMock();
    const storageService = createDriverDocumentStorageServiceMock();
    const membership: DriverMembershipRecord = {
      id: 'membership-1',
      userId: 'user-1',
      institutionId: 'inst-1',
      institutionName: 'UTA',
      role: InstitutionMembershipRole.Student,
      membershipStatus: MembershipStatus.Active,
      studentCode: 'DRV001',
      isDefault: true,
      driverVerificationStatus: DriverVerificationStatus.PendingVerification,
    };
    const profile: DriverProfileRecord = {
      membershipId: 'membership-1',
      userId: 'user-1',
      userFullName: 'Conductor Uno',
      userEmail: 'driver@uta.edu.ec',
      institutionId: 'inst-1',
      institutionName: 'UTA',
      driverVerificationStatus: DriverVerificationStatus.PendingVerification,
      licenseType: {
        id: 'license-type-1',
        code: 'B',
        name: 'Tipo B',
      },
      licenseExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
      identityDocumentFileKey: 'identity-key',
      licenseDocumentFileKey: 'license-key',
      reviewNotes: null,
      reviewedAt: null,
      reviewedByUserId: null,
      submittedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const document: RetrievedDriverDocument = {
      fileName: 'identidad.png',
      mimeType: 'image/png',
      content: Buffer.from('identity-file'),
    };
    repository.findMembershipById.mockResolvedValue(membership);
    repository.findDriverProfileByMembershipId.mockResolvedValue(profile);
    storageService.readDocument.mockResolvedValue(document);

    const useCase = new GetDriverApplicationDocumentUseCase(repository, storageService);
    const result = await useCase.execute(
      buildCurrentUser({ id: 'user-1' }),
      'membership-1',
      DriverDocumentType.Identity,
    );

    expect(storageService.readDocument).toHaveBeenCalledWith('identity-key');
    expect(result).toEqual(document);
  });

  it('allows access for InstitutionAdmin of the same institution', async () => {
    const repository = createDriversRepositoryMock();
    const storageService = createDriverDocumentStorageServiceMock();
    const membership: DriverMembershipRecord = {
      id: 'membership-1',
      userId: 'user-other',
      institutionId: 'inst-1',
      institutionName: 'UTA',
      role: InstitutionMembershipRole.Student,
      membershipStatus: MembershipStatus.Active,
      studentCode: 'DRV001',
      isDefault: false,
      driverVerificationStatus: DriverVerificationStatus.PendingVerification,
    };
    const profile: DriverProfileRecord = {
      membershipId: 'membership-1',
      userId: 'user-other',
      userFullName: 'Conductor Dos',
      userEmail: 'driver2@uta.edu.ec',
      institutionId: 'inst-1',
      institutionName: 'UTA',
      driverVerificationStatus: DriverVerificationStatus.PendingVerification,
      licenseType: {
        id: 'license-type-1',
        code: 'B',
        name: 'Tipo B',
      },
      licenseExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
      identityDocumentFileKey: 'identity-key',
      licenseDocumentFileKey: 'license-key',
      reviewNotes: null,
      reviewedAt: null,
      reviewedByUserId: null,
      submittedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const document: RetrievedDriverDocument = {
      fileName: 'licencia.pdf',
      mimeType: 'application/pdf',
      content: Buffer.from('license-file'),
    };
    repository.findMembershipById.mockResolvedValue(membership);
    repository.findDriverProfileByMembershipId.mockResolvedValue(profile);
    storageService.readDocument.mockResolvedValue(document);

    const useCase = new GetDriverApplicationDocumentUseCase(repository, storageService);
    const result = await useCase.execute(
      buildCurrentUser({
        id: 'admin-1',
        globalRole: GlobalUserRole.User,
        memberships: [
          {
            id: 'm1',
            institutionId: 'inst-1',
            institutionName: 'UTA',
            role: InstitutionMembershipRole.InstitutionAdmin,
            membershipStatus: MembershipStatus.Active,
            institutionIsActive: true,
            studentCode: '123',
            isDefault: true,
            driverVerificationStatus: DriverVerificationStatus.NotRequested,
          },
        ],
      }),
      'membership-1',
      DriverDocumentType.License,
    );

    expect(storageService.readDocument).toHaveBeenCalledWith('license-key');
    expect(result).toEqual(document);
  });
});
