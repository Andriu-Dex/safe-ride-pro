import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  AppNotificationType,
  DriverVerificationStatus,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

import { AuditAction, AuditEntityType } from '../../../src/modules/audit/domain/audit.types';
import { AuditService } from '../../../src/modules/audit/application/services/audit.service';
import { NotificationsService } from '../../../src/modules/notifications/application/services/notifications.service';
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
    listInstitutionAdminMembershipIds: jest.fn(),
    findDriverProfileByMembershipId: jest.fn(),
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
    await expect(
      useCase.execute({
        userId: 'user-1',
        licenseTypeId: 'license-type-1',
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
        licenseExpiresAt: '2020-01-01T10:00:00.000Z',
      }),
    ).rejects.toThrow(
      new BadRequestException('La licencia ingresada ya se encuentra vencida.'),
    );

    expect(repository.submitDriverApplication).not.toHaveBeenCalled();
  });

  it('rejects reusing the same uploaded file for identity and license', async () => {
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
        licenseExpiresAt: '2030-01-01T10:00:00.000Z',
        identityDocumentFileKey: 'same-file',
        licenseDocumentFileKey: 'same-file',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'El documento de identidad y la licencia no pueden ser el mismo archivo.',
      ),
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

  it('submits the application and records audit', async () => {
    const repository = createDriversRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const notificationsService = {
      notifyMembership: jest.fn(),
    } as unknown as jest.Mocked<NotificationsService>;
    const useCase = new SubmitDriverApplicationUseCase(
      repository,
      auditService,
      notificationsService,
    );

    repository.findDefaultMembershipByUserId.mockResolvedValue(buildMembership());
    repository.listInstitutionAdminMembershipIds.mockResolvedValue(['admin-membership-1']);
    repository.submitDriverApplication.mockImplementation(async (input) => buildDriverProfile(input));

    const response = await useCase.execute({
      userId: 'user-1',
      licenseTypeId: 'license-type-1',
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
    expect(notificationsService.notifyMembership).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      recipientMembershipId: 'admin-membership-1',
      actorUserId: 'user-1',
      type: AppNotificationType.DriverApplicationUpdated,
      title: 'Nueva solicitud de conductor',
      body: 'Usuario Uno envio una solicitud para habilitarse como conductor.',
      actionUrl: '/moderacion?section=drivers',
    });
  });

  it('rejects when the user has no default membership', async () => {
    const repository = createDriversRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new SubmitDriverApplicationUseCase(repository, auditService);

    repository.findDefaultMembershipByUserId.mockResolvedValue(null);

    await expect(
      useCase.execute({
        userId: 'user-1',
        licenseTypeId: 'license-type-1',
        licenseExpiresAt: '2030-01-01T10:00:00.000Z',
        identityDocumentFileKey: 'identity-file',
        licenseDocumentFileKey: 'license-file',
      }),
    ).rejects.toThrow(new ForbiddenException('No tienes una membresia activa para solicitar habilitacion como conductor.'));
  });

  it('rejects when the default membership is inactive', async () => {
    const repository = createDriversRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new SubmitDriverApplicationUseCase(repository, auditService);

    repository.findDefaultMembershipByUserId.mockResolvedValue(
      buildMembership({ membershipStatus: MembershipStatus.Inactive }),
    );

    await expect(
      useCase.execute({
        userId: 'user-1',
        licenseTypeId: 'license-type-1',
        licenseExpiresAt: '2030-01-01T10:00:00.000Z',
        identityDocumentFileKey: 'identity-file',
        licenseDocumentFileKey: 'license-file',
      }),
    ).rejects.toThrow(new ForbiddenException('No tienes una membresia activa para solicitar habilitacion como conductor.'));
  });

  it('rejects when the driver verification status is suspended', async () => {
    const repository = createDriversRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new SubmitDriverApplicationUseCase(repository, auditService);

    repository.findDefaultMembershipByUserId.mockResolvedValue(
      buildMembership({ driverVerificationStatus: DriverVerificationStatus.Suspended }),
    );

    await expect(
      useCase.execute({
        userId: 'user-1',
        licenseTypeId: 'license-type-1',
        licenseExpiresAt: '2030-01-01T10:00:00.000Z',
        identityDocumentFileKey: 'identity-file',
        licenseDocumentFileKey: 'license-file',
      }),
    ).rejects.toThrow(new ForbiddenException('Tu perfil de conductor se encuentra suspendido.'));
  });

  it('rejects when the license expiration date is invalid', async () => {
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
        licenseExpiresAt: 'invalid-date',
        identityDocumentFileKey: 'identity-file',
        licenseDocumentFileKey: 'license-file',
      }),
    ).rejects.toThrow(new BadRequestException('La fecha de expiracion de la licencia no es valida.'));
  });

  it('submits application successfully without notifications service', async () => {
    const repository = createDriversRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new SubmitDriverApplicationUseCase(repository, auditService);

    repository.findDefaultMembershipByUserId.mockResolvedValue(buildMembership());
    repository.listInstitutionAdminMembershipIds.mockResolvedValue(['admin-membership-1']);
    repository.submitDriverApplication.mockImplementation(async (input) => buildDriverProfile(input));

    const response = await useCase.execute({
      userId: 'user-1',
      licenseTypeId: 'license-type-1',
      licenseExpiresAt: '2030-01-01T10:00:00.000Z',
      identityDocumentFileKey: 'identity-file',
      licenseDocumentFileKey: 'license-file',
    });

    expect(response.message).toBe('Tu solicitud de conductor fue enviada y esta pendiente de revision.');
    expect(repository.submitDriverApplication).toHaveBeenCalled();
  });
});
