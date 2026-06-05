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
import { GetCurrentUserTrustSummaryUseCase } from '../../../src/modules/users/application/use-cases/get-current-user-trust-summary.use-case';
import { GetCurrentUserUseCase } from '../../../src/modules/users/application/use-cases/get-current-user.use-case';
import { ListAdminUserDirectoryUseCase } from '../../../src/modules/users/application/use-cases/list-admin-user-directory.use-case';
import { UpdateAdminUserAccountStatusUseCase } from '../../../src/modules/users/application/use-cases/update-admin-user-account-status.use-case';
import { UpdateCurrentUserUseCase } from '../../../src/modules/users/application/use-cases/update-current-user.use-case';
import { UploadCurrentUserProfilePhotoUseCase } from '../../../src/modules/users/application/use-cases/upload-current-user-profile-photo.use-case';
import { UsersController } from '../../../src/modules/users/presentation/controllers/users.controller';
import { createAuthenticatedHttpContext } from '../../helpers/create-authenticated-http-context';
import { createHttpTestApp } from '../../helpers/create-test-app';

describe('UsersController HTTP', () => {
  let app: INestApplication;
  const getCurrentUserUseCase = { execute: jest.fn() };
  const listAdminUserDirectoryUseCase = { execute: jest.fn() };
  const getCurrentUserTrustSummaryUseCase = { execute: jest.fn() };
  const updateCurrentUserUseCase = { execute: jest.fn() };
  const updateAdminUserAccountStatusUseCase = { execute: jest.fn() };
  const uploadCurrentUserProfilePhotoUseCase = { execute: jest.fn() };

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
      controllers: [UsersController],
      providers: [
        { provide: GetCurrentUserUseCase, useValue: getCurrentUserUseCase },
        { provide: ListAdminUserDirectoryUseCase, useValue: listAdminUserDirectoryUseCase },
        {
          provide: GetCurrentUserTrustSummaryUseCase,
          useValue: getCurrentUserTrustSummaryUseCase,
        },
        { provide: UpdateCurrentUserUseCase, useValue: updateCurrentUserUseCase },
        {
          provide: UpdateAdminUserAccountStatusUseCase,
          useValue: updateAdminUserAccountStatusUseCase,
        },
        {
          provide: UploadCurrentUserProfilePhotoUseCase,
          useValue: uploadCurrentUserProfilePhotoUseCase,
        },
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

  it('returns the current authenticated user', async () => {
    getCurrentUserUseCase.execute.mockResolvedValue({
      id: 'admin-1',
      fullName: 'Admin UTA',
    });

    const response = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(response.body).toEqual({
      id: 'admin-1',
      fullName: 'Admin UTA',
    });
    expect(getCurrentUserUseCase.execute).toHaveBeenCalledWith('admin-1');
  });

  it('returns the trust summary for the current user', async () => {
    getCurrentUserTrustSummaryUseCase.execute.mockResolvedValue({
      score: 4.8,
      reportsOpen: 0,
    });

    await request(app.getHttpServer())
      .get('/api/users/me/trust-summary')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(getCurrentUserTrustSummaryUseCase.execute).toHaveBeenCalledWith('admin-1');
  });

  it('lists the admin directory using transformed filters', async () => {
    listAdminUserDirectoryUseCase.execute.mockResolvedValue({
      items: [],
    });

    await request(app.getHttpServer())
      .get('/api/users/admin/directory')
      .set('Authorization', 'Bearer test-token')
      .query({
        institutionId: 'institution-1',
        query: ' andrea ',
        accountStatus: AccountStatus.Active,
        driverVerificationStatus: DriverVerificationStatus.Approved,
        limit: '25',
      })
      .expect(200);

    expect(listAdminUserDirectoryUseCase.execute).toHaveBeenCalledWith({
      currentUser: expect.objectContaining({ id: 'admin-1' }),
      institutionId: 'institution-1',
      query: 'andrea',
      accountStatus: AccountStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
      limit: 25,
    });
  });

  it('updates the account status for an admin-managed user', async () => {
    updateAdminUserAccountStatusUseCase.execute.mockResolvedValue({
      message: 'Estado actualizado correctamente.',
    });

    const response = await request(app.getHttpServer())
      .patch('/api/users/admin/user-2/account-status')
      .set('Authorization', 'Bearer test-token')
      .send({
        accountStatus: AccountStatus.Suspended,
      })
      .expect(200);

    expect(response.body).toEqual({
      message: 'Estado actualizado correctamente.',
    });
    expect(updateAdminUserAccountStatusUseCase.execute).toHaveBeenCalledWith({
      currentUser: expect.objectContaining({ id: 'admin-1' }),
      userId: 'user-2',
      accountStatus: AccountStatus.Suspended,
    });
  });

  it('rejects invalid current-user payloads before reaching the use case', async () => {
    await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', 'Bearer test-token')
      .send({
        phone: '0812345678',
      })
      .expect(400);

    expect(updateCurrentUserUseCase.execute).not.toHaveBeenCalled();
  });

  it('uploads the current user profile photo', async () => {
    uploadCurrentUserProfilePhotoUseCase.execute.mockResolvedValue({
      message: 'Foto actualizada correctamente.',
      profilePhotoUrl: 'https://cdn.test/profile.png',
    });

    const response = await request(app.getHttpServer())
      .post('/api/users/me/profile-photo')
      .set('Authorization', 'Bearer test-token')
      .attach('file', Buffer.from('image-content'), {
        filename: 'profile.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(response.body).toEqual({
      message: 'Foto actualizada correctamente.',
      profilePhotoUrl: 'https://cdn.test/profile.png',
    });
    expect(uploadCurrentUserProfilePhotoUseCase.execute).toHaveBeenCalledWith(
      'admin-1',
      expect.objectContaining({
        originalname: 'profile.png',
        mimetype: 'image/png',
      }),
    );
  });
});
