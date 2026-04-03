import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  DriverVerificationStatus,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

import { AuditAction, AuditEntityType } from '../../../src/modules/audit/domain/audit.types';
import { AuditService } from '../../../src/modules/audit/application/services/audit.service';
import { SubmitDriverApplicationUseCase } from '../../../src/modules/drivers/application/use-cases/submit-driver-application.use-case';
import type {
  DriverMembershipRecord,
  DriverProfileRecord,
  DriversRepository,
  SubmitDriverApplicationInput,
} from '../../../src/modules/drivers/application/ports/drivers.repository';

function createDriversRepositoryMock(): jest.Mocked<DriversRepository> {
  return {
    findDefaultMembershipByUserId: jest.fn(),
    findMembershipById: jest.fn(),
    findDriverProfileByMembershipId: jest.fn(),
    findDriverProfileByLicenseNumber: jest.fn(),
    listReviewableDriverApplications: jest.fn(),
    submitDriverApplication: jest.fn(),
    reviewDriverApplication: jest.fn(),
  };
}

function buildMembership(
  overrides: Partial<DriverMembershipRecord> = {},
): DriverMembershipRecord {
  return {
    id: 'membership-1',
    userId: 'user-1',
    institutionId: 'institution-1',
    institutionName: 'UTA',
    role: InstitutionMembershipRole.Student,
    membershipStatus: MembershipStatus.Active,
    studentCode: 'STUDENT-001',
    isDefault: true,
    driverVerificationStatus: DriverVerificationStatus.NotRequested,
    ...overrides,
  };
}

function buildDriverProfile(
  input: SubmitDriverApplicationInput,
): DriverProfileRecord {
  return {
    membershipId: input.membershipId,
    userId: 'user-1',
    userFullName: 'Usuario Uno',
    userEmail: 'user@uta.edu.ec',
    institutionId: 'institution-1',
    institutionName: 'UTA',
    driverVerificationStatus: DriverVerificationStatus.PendingVerification,
    licenseType: {
      id: input.licenseTypeId,
      code: 'B',
      name: 'Licencia B',
    },
    licenseNumber: input.licenseNumber,
    licenseExpiresAt: input.licenseExpiresAt,
    identityDocumentFileKey: input.identityDocumentFileKey ?? null,
    licenseDocumentFileKey: input.licenseDocumentFileKey ?? null,
    reviewNotes: null,
    reviewedAt: null,
    reviewedByUserId: null,
    submittedAt: new Date('2030-01-01T10:00:00.000Z'),
  };
}

describe('SubmitDriverApplicationUseCase', () => {
  it('rejects applications without required documents', async () => {
    const repository = createDriversRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new SubmitDriverApplicationUseCase(repository, auditService);

    repository.findDefaultMembershipByUserId.mockResolvedValue(buildMembership());
    repository.findDriverProfileByLicenseNumber.mockResolvedValue(null);

    await expect(
      useCase.execute({
        userId: 'user-1',
        licenseTypeId: 'license-type-1',
        licenseNumber: 'ABC-123',
        licenseExpiresAt: '2030-01-01T10:00:00.000Z',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Debes cargar el documento de identidad y el documento de licencia antes de enviar la solicitud.',
      ),
    );

    expect(repository.submitDriverApplication).not.toHaveBeenCalled();
  });

  it('rejects expired licenses', async () => {
    const repository = createDriversRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new SubmitDriverApplicationUseCase(repository, auditService);

    repository.findDefaultMembershipByUserId.mockResolvedValue(buildMembership());

    await expect(
      useCase.execute({
        userId: 'user-1',
        licenseTypeId: 'license-type-1',
        licenseNumber: 'abc-123',
        licenseExpiresAt: '2020-01-01T10:00:00.000Z',
      }),
    ).rejects.toThrow(
      new BadRequestException('La licencia ingresada ya se encuentra vencida.'),
    );

    expect(repository.submitDriverApplication).not.toHaveBeenCalled();
  });

  it('rejects institutional admins acting as drivers', async () => {
    const repository = createDriversRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new SubmitDriverApplicationUseCase(repository, auditService);

    repository.findDefaultMembershipByUserId.mockResolvedValue(
      buildMembership({
        role: InstitutionMembershipRole.InstitutionAdmin,
      }),
    );

    await expect(
      useCase.execute({
        userId: 'user-1',
        licenseTypeId: 'license-type-1',
        licenseNumber: 'abc-123',
        licenseExpiresAt: '2030-01-01T10:00:00.000Z',
        identityDocumentFileKey: 'identity-file',
        licenseDocumentFileKey: 'license-file',
      }),
    ).rejects.toThrow(
      new ForbiddenException(
        'La membresia administrativa no puede solicitar habilitacion como conductor.',
      ),
    );

    expect(repository.submitDriverApplication).not.toHaveBeenCalled();
  });

  it('rejects resubmission when the driver profile is already approved and vigente', async () => {
    const repository = createDriversRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new SubmitDriverApplicationUseCase(repository, auditService);

    repository.findDefaultMembershipByUserId.mockResolvedValue(
      buildMembership({
        driverVerificationStatus: DriverVerificationStatus.Approved,
        effectiveDriverVerificationStatus: DriverVerificationStatus.Approved,
      }),
    );

    await expect(
      useCase.execute({
        userId: 'user-1',
        licenseTypeId: 'license-type-1',
        licenseNumber: 'abc-123',
        licenseExpiresAt: '2030-01-01T10:00:00.000Z',
        identityDocumentFileKey: 'identity-file',
        licenseDocumentFileKey: 'license-file',
      }),
    ).rejects.toThrow(
      new ForbiddenException(
        'Tu perfil de conductor ya fue aprobado. Si necesitas actualizar documentos, contacta a administracion.',
      ),
    );

    expect(repository.submitDriverApplication).not.toHaveBeenCalled();
  });

  it('normalizes the license number, submits the application and records audit', async () => {
    const repository = createDriversRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new SubmitDriverApplicationUseCase(repository, auditService);

    repository.findDefaultMembershipByUserId.mockResolvedValue(buildMembership());
    repository.findDriverProfileByLicenseNumber.mockResolvedValue(null);
    repository.submitDriverApplication.mockImplementation(async (input) => buildDriverProfile(input));

    const response = await useCase.execute({
      userId: 'user-1',
      licenseTypeId: 'license-type-1',
      licenseNumber: '  abc-123  ',
      licenseExpiresAt: '2030-01-01T10:00:00.000Z',
      identityDocumentFileKey: '  identity-file  ',
      licenseDocumentFileKey: '  license-file  ',
    });

    expect(response.message).toBe(
      'Tu solicitud de conductor fue enviada y esta pendiente de revision.',
    );
    expect(repository.submitDriverApplication).toHaveBeenCalledWith({
      membershipId: 'membership-1',
      licenseTypeId: 'license-type-1',
      licenseNumber: 'ABC-123',
      licenseExpiresAt: new Date('2030-01-01T10:00:00.000Z'),
      identityDocumentFileKey: 'identity-file',
      licenseDocumentFileKey: 'license-file',
    });
    expect(auditService.record).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      actorUserId: 'user-1',
      action: AuditAction.DriverApplicationSubmitted,
      entityType: AuditEntityType.DriverProfile,
      entityId: 'membership-1',
      metadata: {
        driverVerificationStatus: DriverVerificationStatus.PendingVerification,
      },
    });
  });
});
