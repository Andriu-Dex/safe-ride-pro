import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AccountStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

import type { AuditService } from '../../../src/modules/audit/application/services/audit.service';
import type { CurrentUserContext } from '../../../src/modules/auth/application/types/current-user-context.type';
import type {
  InstitutionSettingsRecord,
  InstitutionSummary,
  InstitutionsRepository,
} from '../../../src/modules/institutions/application/ports/institutions.repository';
import { UpdateInstitutionSettingsUseCase } from '../../../src/modules/institutions/application/use-cases/update-institution-settings.use-case';

function createInstitutionsRepositoryMock(): jest.Mocked<InstitutionsRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    listActive: jest.fn(),
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
    updateStatus: jest.fn(),
  };
}

type AuditServiceMock = Pick<AuditService, 'record'>;

function createAuditServiceMock(): jest.Mocked<AuditServiceMock> {
  return {
    record: jest.fn(),
  };
}

function buildCurrentUser(overrides: Partial<CurrentUserContext> = {}): CurrentUserContext {
  return {
    id: 'admin-1',
    email: 'admin@uta.edu.ec',
    fullName: 'Admin User',
    globalRole: GlobalUserRole.User,
    accountStatus: AccountStatus.Active,
    memberships: [],
    ...overrides,
  };
}

describe('UpdateInstitutionSettingsUseCase', () => {
  it('throws ForbiddenException if user does not have managed institution permissions', async () => {
    const repository = createInstitutionsRepositoryMock();
    const auditService = createAuditServiceMock();
    const useCase = new UpdateInstitutionSettingsUseCase(
      repository,
      auditService as unknown as AuditService,
    );

    await expect(
      useCase.execute(
        buildCurrentUser({
          globalRole: GlobalUserRole.User,
          memberships: [
            {
              id: 'm1',
              institutionId: 'inst-1',
              institutionName: 'UTA',
              institutionIsActive: true,
              role: InstitutionMembershipRole.Student,
              membershipStatus: MembershipStatus.Active,
              studentCode: '123',
              isDefault: true,
              driverVerificationStatus: DriverVerificationStatus.NotRequested,
            },
          ],
        }),
        {
          institutionId: 'inst-1',
          allowCashPayments: true,
          allowPaypalPayments: false,
          allowWalletPayments: true,
          safetyRulesTitle: 'Rules',
          safetyRulesSummary: 'Summary',
          safetyRulesBody: 'Body',
        },
      ),
    ).rejects.toThrow(new ForbiddenException('Solo un administrador institucional puede actualizar esta configuracion.'));
  });

  it('throws NotFoundException if the requested institution is not found', async () => {
    const repository = createInstitutionsRepositoryMock();
    const auditService = createAuditServiceMock();
    repository.findById.mockResolvedValue(null);
    const useCase = new UpdateInstitutionSettingsUseCase(
      repository,
      auditService as unknown as AuditService,
    );

    await expect(
      useCase.execute(
        buildCurrentUser({
          globalRole: GlobalUserRole.SuperAdmin,
          memberships: [
            {
              id: 'm1',
              institutionId: 'inst-1',
              institutionName: 'UTA',
              institutionIsActive: true,
              role: InstitutionMembershipRole.InstitutionAdmin,
              membershipStatus: MembershipStatus.Active,
              studentCode: '123',
              isDefault: true,
              driverVerificationStatus: DriverVerificationStatus.NotRequested,
            },
          ],
        }),
        {
          institutionId: 'inst-1',
          allowCashPayments: true,
          allowPaypalPayments: false,
          allowWalletPayments: true,
          safetyRulesTitle: 'Rules',
          safetyRulesSummary: 'Summary',
          safetyRulesBody: 'Body',
        },
      ),
    ).rejects.toThrow(new NotFoundException('La institucion indicada no existe.'));
  });

  it('successfully updates settings and writes to audit service', async () => {
    const repository = createInstitutionsRepositoryMock();
    const auditService = createAuditServiceMock();
    const mockInstitution: InstitutionSummary = {
      id: 'inst-1',
      name: 'UTA',
      code: 'UTA',
      domains: ['uta.edu.ec'],
      isActive: true,
    };
    const mockSettings: InstitutionSettingsRecord = {
      institutionId: 'inst-1',
      allowCashPayments: true,
      allowPaypalPayments: false,
      allowWalletPayments: true,
      termsDocumentUrl: null,
      privacyPolicyUrl: 'https://uta.edu.ec/privacy',
      safetyRulesTitle: 'Rules',
      safetyRulesSummary: 'Summary',
      safetyRulesBody: 'Body',
      createdAt: null,
      updatedAt: null,
    };

    repository.findById.mockResolvedValue(mockInstitution);
    repository.updateSettings.mockResolvedValue(mockSettings);
    auditService.record.mockResolvedValue(undefined);

    const useCase = new UpdateInstitutionSettingsUseCase(
      repository,
      auditService as unknown as AuditService,
    );
    const result = await useCase.execute(
      buildCurrentUser({
        globalRole: GlobalUserRole.User,
        memberships: [
          {
            id: 'm1',
            institutionId: 'inst-1',
            institutionName: 'UTA',
            institutionIsActive: true,
            role: InstitutionMembershipRole.InstitutionAdmin,
            membershipStatus: MembershipStatus.Active,
            studentCode: '123',
            isDefault: true,
            driverVerificationStatus: DriverVerificationStatus.NotRequested,
          },
        ],
      }),
      {
        institutionId: 'inst-1',
        allowCashPayments: true,
        allowPaypalPayments: false,
        allowWalletPayments: true,
        termsDocumentUrl: '  ',
        privacyPolicyUrl: 'https://uta.edu.ec/privacy',
        safetyRulesTitle: ' Rules ',
        safetyRulesSummary: ' Summary ',
        safetyRulesBody: ' Body ',
      },
    );

    expect(repository.findById).toHaveBeenCalledWith('inst-1');
    expect(repository.updateSettings).toHaveBeenCalledWith({
      institutionId: 'inst-1',
      allowCashPayments: true,
      allowPaypalPayments: false,
      allowWalletPayments: true,
      termsDocumentUrl: null,
      privacyPolicyUrl: 'https://uta.edu.ec/privacy',
      safetyRulesTitle: 'Rules',
      safetyRulesSummary: 'Summary',
      safetyRulesBody: 'Body',
    });
    expect(auditService.record).toHaveBeenCalledTimes(1);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        institutionId: 'inst-1',
        entityId: 'inst-1',
      }),
    );
    expect(result.message).toBe('La configuracion institucional fue actualizada correctamente.');
    expect(result.settings).toEqual(mockSettings);
  });

  it('successfully updates settings and falls back to normalized value if allowWalletPayments is missing in response', async () => {
    const repository = createInstitutionsRepositoryMock();
    const auditService = createAuditServiceMock();
    const mockInstitution: InstitutionSummary = {
      id: 'inst-1',
      name: 'UTA',
      code: 'UTA',
      domains: ['uta.edu.ec'],
      isActive: true,
    };
    const mockSettings: InstitutionSettingsRecord = {
      institutionId: 'inst-1',
      allowCashPayments: true,
      allowPaypalPayments: false,
      allowWalletPayments: undefined,
      termsDocumentUrl: null,
      privacyPolicyUrl: 'https://uta.edu.ec/privacy',
      safetyRulesTitle: 'Rules',
      safetyRulesSummary: 'Summary',
      safetyRulesBody: 'Body',
      createdAt: null,
      updatedAt: null,
    };

    repository.findById.mockResolvedValue(mockInstitution);
    repository.updateSettings.mockResolvedValue(mockSettings);
    auditService.record.mockResolvedValue(undefined);

    const useCase = new UpdateInstitutionSettingsUseCase(
      repository,
      auditService as unknown as AuditService,
    );
    const result = await useCase.execute(
      buildCurrentUser({
        globalRole: GlobalUserRole.User,
        memberships: [
          {
            id: 'm1',
            institutionId: 'inst-1',
            institutionName: 'UTA',
            institutionIsActive: true,
            role: InstitutionMembershipRole.InstitutionAdmin,
            membershipStatus: MembershipStatus.Active,
            studentCode: '123',
            isDefault: true,
            driverVerificationStatus: DriverVerificationStatus.NotRequested,
          },
        ],
      }),
      {
        institutionId: 'inst-1',
        allowCashPayments: true,
        allowPaypalPayments: false,
        allowWalletPayments: true,
        termsDocumentUrl: '',
        privacyPolicyUrl: 'https://uta.edu.ec/privacy',
        safetyRulesTitle: 'Rules',
        safetyRulesSummary: 'Summary',
        safetyRulesBody: 'Body',
      },
    );

    expect(result.settings.allowWalletPayments).toBeUndefined();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          allowWalletPayments: true,
        }),
      }),
    );
  });
});
