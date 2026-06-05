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
  InstitutionSettingsRecord,
  InstitutionSummary,
  InstitutionsRepository,
} from '../../../src/modules/institutions/application/ports/institutions.repository';
import { GetInstitutionSettingsUseCase } from '../../../src/modules/institutions/application/use-cases/get-institution-settings.use-case';

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

describe('GetInstitutionSettingsUseCase', () => {
  it('throws ForbiddenException if non-SuperAdmin has no active memberships', async () => {
    const repository = createInstitutionsRepositoryMock();
    const useCase = new GetInstitutionSettingsUseCase(repository);

    await expect(
      useCase.execute(buildCurrentUser({ globalRole: GlobalUserRole.User, memberships: [] })),
    ).rejects.toThrow(
      new ForbiddenException('No tienes una membresia institucional activa para consultar configuraciones.'),
    );
  });

  it('throws ForbiddenException if requesting an institution with no access', async () => {
    const repository = createInstitutionsRepositoryMock();
    const useCase = new GetInstitutionSettingsUseCase(repository);

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
        'inst-2',
      ),
    ).rejects.toThrow(new ForbiddenException('No tienes acceso a la configuracion de la institucion solicitada.'));
  });

  it('throws NotFoundException if institution is not found in DB', async () => {
    const repository = createInstitutionsRepositoryMock();
    repository.findById.mockResolvedValue(null);
    const useCase = new GetInstitutionSettingsUseCase(repository);

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
        'inst-1',
      ),
    ).rejects.toThrow(new NotFoundException('La institucion indicada no existe.'));
  });

  it('successfully returns settings for accessible requested institution id', async () => {
    const repository = createInstitutionsRepositoryMock();
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
      privacyPolicyUrl: null,
      safetyRulesTitle: 'Reglas',
      safetyRulesSummary: 'Resumen',
      safetyRulesBody: 'Contenido',
      createdAt: null,
      updatedAt: null,
    };
    repository.findById.mockResolvedValue(mockInstitution);
    repository.getSettings.mockResolvedValue(mockSettings);

    const useCase = new GetInstitutionSettingsUseCase(repository);
    const result = await useCase.execute(
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
      'inst-1',
    );

    expect(repository.findById).toHaveBeenCalledWith('inst-1');
    expect(repository.getSettings).toHaveBeenCalledWith('inst-1');
    expect(result).toEqual({
      institution: mockInstitution,
      settings: mockSettings,
    });
  });
});
