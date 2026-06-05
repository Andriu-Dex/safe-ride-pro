import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  AccountStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

import { CurrentUserContext } from '../../../src/modules/auth/application/types/current-user-context.type';
import { SuperAdminGuard } from '../../../src/modules/auth/presentation/guards/super-admin.guard';
import { CreateInstitutionUseCase } from '../../../src/modules/institutions/application/use-cases/create-institution.use-case';
import { GetInstitutionSettingsUseCase } from '../../../src/modules/institutions/application/use-cases/get-institution-settings.use-case';
import { ListActiveInstitutionsUseCase } from '../../../src/modules/institutions/application/use-cases/list-active-institutions.use-case';
import { UpdateInstitutionSettingsUseCase } from '../../../src/modules/institutions/application/use-cases/update-institution-settings.use-case';
import { UpdateInstitutionStatusUseCase } from '../../../src/modules/institutions/application/use-cases/update-institution-status.use-case';
import { InstitutionsController } from '../../../src/modules/institutions/presentation/controllers/institutions.controller';
import { createAuthenticatedHttpContext } from '../../helpers/create-authenticated-http-context';
import { createHttpTestApp } from '../../helpers/create-test-app';

describe('InstitutionsController HTTP', () => {
  let app: INestApplication;
  const listActiveInstitutionsUseCase = { execute: jest.fn() };
  const createInstitutionUseCase = { execute: jest.fn() };
  const updateInstitutionStatusUseCase = { execute: jest.fn() };
  const getInstitutionSettingsUseCase = { execute: jest.fn() };
  const updateInstitutionSettingsUseCase = { execute: jest.fn() };

  const authenticatedAdmin: CurrentUserContext = {
    id: 'admin-1',
    email: 'admin@uta.edu.ec',
    fullName: 'Admin UTA',
    globalRole: GlobalUserRole.SuperAdmin,
    accountStatus: AccountStatus.Active,
    memberships: [
      {
        id: 'membership-admin',
        institutionId: 'institution-1',
        institutionName: 'UTA',
        role: InstitutionMembershipRole.InstitutionAdmin,
        membershipStatus: MembershipStatus.Active,
        studentCode: 'ADMIN-001',
        isDefault: true,
        driverVerificationStatus: DriverVerificationStatus.NotRequested,
      },
    ],
  };

  const authenticatedHttpContext = createAuthenticatedHttpContext(authenticatedAdmin);

  beforeAll(async () => {
    const testApp = await createHttpTestApp({
      controllers: [InstitutionsController],
      providers: [
        { provide: ListActiveInstitutionsUseCase, useValue: listActiveInstitutionsUseCase },
        { provide: CreateInstitutionUseCase, useValue: createInstitutionUseCase },
        { provide: UpdateInstitutionStatusUseCase, useValue: updateInstitutionStatusUseCase },
        { provide: GetInstitutionSettingsUseCase, useValue: getInstitutionSettingsUseCase },
        {
          provide: UpdateInstitutionSettingsUseCase,
          useValue: updateInstitutionSettingsUseCase,
        },
        SuperAdminGuard,
        ...authenticatedHttpContext.guardProviders,
      ],
    });

    app = testApp.app;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authenticatedHttpContext.applyAuthenticatedUser();
  });

  it('lists active institutions publicly', async () => {
    listActiveInstitutionsUseCase.execute.mockResolvedValue([
      { id: 'institution-1', name: 'UTA' },
    ]);

    const response = await request(app.getHttpServer())
      .get('/api/institutions')
      .expect(200);

    expect(response.body).toEqual([{ id: 'institution-1', name: 'UTA' }]);
    expect(listActiveInstitutionsUseCase.execute).toHaveBeenCalled();
  });

  it('returns institution settings for the authenticated user context', async () => {
    getInstitutionSettingsUseCase.execute.mockResolvedValue({
      allowCashPayments: true,
    });

    await request(app.getHttpServer())
      .get('/api/institutions/settings')
      .set('Authorization', 'Bearer test-token')
      .query({ institutionId: 'institution-1' })
      .expect(200);

    expect(getInstitutionSettingsUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'admin-1' }),
      'institution-1',
    );
  });

  it('creates an institution through the super-admin endpoint', async () => {
    createInstitutionUseCase.execute.mockResolvedValue({
      id: 'institution-2',
      name: 'Nueva Institucion',
    });

    const response = await request(app.getHttpServer())
      .post('/api/institutions')
      .set('Authorization', 'Bearer test-token')
      .send({
        name: 'Nueva Institucion',
        code: 'NI',
        domains: ['ni.edu.ec'],
      })
      .expect(201);

    expect(response.body).toEqual({
      id: 'institution-2',
      name: 'Nueva Institucion',
    });
    expect(createInstitutionUseCase.execute).toHaveBeenCalledWith({
      name: 'Nueva Institucion',
      code: 'NI',
      domains: ['ni.edu.ec'],
    });
  });

  it('rejects invalid institution creation payloads before reaching the use case', async () => {
    await request(app.getHttpServer())
      .post('/api/institutions')
      .set('Authorization', 'Bearer test-token')
      .send({
        name: 'Sin dominios',
        code: 'SD',
        domains: [],
      })
      .expect(400);

    expect(createInstitutionUseCase.execute).not.toHaveBeenCalled();
  });

  it('updates an institution status', async () => {
    updateInstitutionStatusUseCase.execute.mockResolvedValue({
      id: 'institution-1',
      isActive: false,
    });

    await request(app.getHttpServer())
      .patch('/api/institutions/institution-1/status')
      .set('Authorization', 'Bearer test-token')
      .send({
        isActive: false,
      })
      .expect(200);

    expect(updateInstitutionStatusUseCase.execute).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      isActive: false,
    });
  });

  it('updates institution settings using the authenticated user context', async () => {
    updateInstitutionSettingsUseCase.execute.mockResolvedValue({
      allowWalletPayments: true,
    });

    await request(app.getHttpServer())
      .patch('/api/institutions/settings')
      .set('Authorization', 'Bearer test-token')
      .query({ institutionId: 'institution-1' })
      .send({
        allowCashPayments: true,
        allowPaypalPayments: true,
        allowWalletPayments: true,
        termsDocumentUrl: 'https://uta.edu.ec/terminos.pdf',
        privacyPolicyUrl: 'https://uta.edu.ec/privacidad.pdf',
        safetyRulesTitle: 'Reglas de seguridad',
        safetyRulesSummary: 'Resumen operativo',
        safetyRulesBody: 'Contenido completo',
      })
      .expect(200);

    expect(updateInstitutionSettingsUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'admin-1' }),
      {
        institutionId: 'institution-1',
        allowCashPayments: true,
        allowPaypalPayments: true,
        allowWalletPayments: true,
        termsDocumentUrl: 'https://uta.edu.ec/terminos.pdf',
        privacyPolicyUrl: 'https://uta.edu.ec/privacidad.pdf',
        safetyRulesTitle: 'Reglas de seguridad',
        safetyRulesSummary: 'Resumen operativo',
        safetyRulesBody: 'Contenido completo',
      },
    );
  });
});
