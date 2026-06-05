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
import { GetDriverApplicationDocumentUseCase } from '../../../src/modules/drivers/application/use-cases/get-driver-application-document.use-case';
import { GetCurrentDriverProfileUseCase } from '../../../src/modules/drivers/application/use-cases/get-current-driver-profile.use-case';
import { ListReviewableDriverApplicationsUseCase } from '../../../src/modules/drivers/application/use-cases/list-reviewable-driver-applications.use-case';
import { ReviewDriverApplicationUseCase } from '../../../src/modules/drivers/application/use-cases/review-driver-application.use-case';
import { SubmitDriverApplicationUseCase } from '../../../src/modules/drivers/application/use-cases/submit-driver-application.use-case';
import { UploadDriverDocumentUseCase } from '../../../src/modules/drivers/application/use-cases/upload-driver-document.use-case';
import { DriverDocumentType } from '../../../src/modules/drivers/application/ports/drivers.repository';
import { DriversController } from '../../../src/modules/drivers/presentation/controllers/drivers.controller';
import { createAuthenticatedHttpContext } from '../../helpers/create-authenticated-http-context';
import { createHttpTestApp } from '../../helpers/create-test-app';

describe('DriversController HTTP', () => {
  let app: INestApplication;
  const getCurrentDriverProfileUseCase = { execute: jest.fn() };
  const submitDriverApplicationUseCase = { execute: jest.fn() };
  const uploadDriverDocumentUseCase = { execute: jest.fn() };
  const listReviewableDriverApplicationsUseCase = { execute: jest.fn() };
  const getDriverApplicationDocumentUseCase = { execute: jest.fn() };
  const reviewDriverApplicationUseCase = { execute: jest.fn() };

  const authenticatedDriver: CurrentUserContext = {
    id: 'driver-1',
    email: 'driver@uta.edu.ec',
    fullName: 'Conductor Uno',
    globalRole: GlobalUserRole.User,
    accountStatus: AccountStatus.Active,
    memberships: [
      {
        id: 'membership-driver',
        institutionId: 'institution-1',
        institutionName: 'UTA',
        role: InstitutionMembershipRole.Student,
        membershipStatus: MembershipStatus.Active,
        studentCode: 'DRV001',
        isDefault: true,
        driverVerificationStatus: DriverVerificationStatus.PendingVerification,
      },
    ],
  };

  const authenticatedHttpContext = createAuthenticatedHttpContext(authenticatedDriver);

  beforeAll(async () => {
    const testApp = await createHttpTestApp({
      controllers: [DriversController],
      providers: [
        {
          provide: GetCurrentDriverProfileUseCase,
          useValue: getCurrentDriverProfileUseCase,
        },
        {
          provide: SubmitDriverApplicationUseCase,
          useValue: submitDriverApplicationUseCase,
        },
        { provide: UploadDriverDocumentUseCase, useValue: uploadDriverDocumentUseCase },
        {
          provide: ListReviewableDriverApplicationsUseCase,
          useValue: listReviewableDriverApplicationsUseCase,
        },
        {
          provide: GetDriverApplicationDocumentUseCase,
          useValue: getDriverApplicationDocumentUseCase,
        },
        {
          provide: ReviewDriverApplicationUseCase,
          useValue: reviewDriverApplicationUseCase,
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

  it('returns the current driver profile', async () => {
    getCurrentDriverProfileUseCase.execute.mockResolvedValue({
      membershipId: 'membership-driver',
    });

    await request(app.getHttpServer())
      .get('/api/drivers/me')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(getCurrentDriverProfileUseCase.execute).toHaveBeenCalledWith('driver-1');
  });

  it('uploads driver documents and submits the application', async () => {
    uploadDriverDocumentUseCase.execute.mockResolvedValue({
      fileKey: 'drivers/identity.png',
    });
    submitDriverApplicationUseCase.execute.mockResolvedValue({
      membershipId: 'membership-driver',
    });

    await request(app.getHttpServer())
      .post('/api/drivers/me/documents/identity')
      .set('Authorization', 'Bearer test-token')
      .attach('file', Buffer.from('identity-content'), {
        filename: 'cedula.png',
        contentType: 'image/png',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/drivers/application')
      .set('Authorization', 'Bearer test-token')
      .send({
        licenseTypeId: '8fe59d21-01aa-4764-b9f5-fa05a13997e4',
        licenseExpiresAt: '2030-01-01T00:00:00.000Z',
        identityDocumentFileKey: 'drivers/identity.png',
        licenseDocumentFileKey: 'drivers/license.png',
      })
      .expect(201);

    expect(uploadDriverDocumentUseCase.execute).toHaveBeenCalledWith(
      'driver-1',
      DriverDocumentType.Identity,
      expect.objectContaining({
        originalname: 'cedula.png',
        mimetype: 'image/png',
      }),
    );
    expect(submitDriverApplicationUseCase.execute).toHaveBeenCalledWith({
      userId: 'driver-1',
      licenseTypeId: '8fe59d21-01aa-4764-b9f5-fa05a13997e4',
      licenseExpiresAt: '2030-01-01T00:00:00.000Z',
      identityDocumentFileKey: 'drivers/identity.png',
      licenseDocumentFileKey: 'drivers/license.png',
    });
  });

  it('lists reviewable applications and downloads a document', async () => {
    listReviewableDriverApplicationsUseCase.execute.mockResolvedValue({
      items: [],
    });
    getDriverApplicationDocumentUseCase.execute.mockResolvedValue({
      fileName: 'licencia.pdf',
      mimeType: 'application/pdf',
      content: Buffer.from('pdf-content'),
    });

    await request(app.getHttpServer())
      .get('/api/drivers/applications/inbox')
      .set('Authorization', 'Bearer test-token')
      .query({
        institutionId: 'institution-1',
        status: DriverVerificationStatus.PendingVerification,
        limit: '20',
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/api/drivers/applications/membership-driver/documents/license')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(listReviewableDriverApplicationsUseCase.execute).toHaveBeenCalledWith({
      currentUser: expect.objectContaining({ id: 'driver-1' }),
      institutionId: 'institution-1',
      status: DriverVerificationStatus.PendingVerification,
      limit: 20,
    });
    expect(getDriverApplicationDocumentUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'driver-1' }),
      'membership-driver',
      DriverDocumentType.License,
    );
    expect(response.header['content-type']).toContain('application/pdf');
    expect(response.header['content-disposition']).toContain('licencia.pdf');
  });

  it('reviews an application with the authenticated user context', async () => {
    reviewDriverApplicationUseCase.execute.mockResolvedValue({
      membershipId: 'membership-driver',
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });

    await request(app.getHttpServer())
      .patch('/api/drivers/applications/membership-driver/review')
      .set('Authorization', 'Bearer test-token')
      .send({
        decision: DriverVerificationStatus.Approved,
        reviewNotes: 'Solicitud aprobada',
      })
      .expect(200);

    expect(reviewDriverApplicationUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'driver-1' }),
      {
        membershipId: 'membership-driver',
        decision: DriverVerificationStatus.Approved,
        reviewNotes: 'Solicitud aprobada',
      },
    );
  });

  it('rejects invalid application payloads before reaching the submit use case', async () => {
    await request(app.getHttpServer())
      .post('/api/drivers/application')
      .set('Authorization', 'Bearer test-token')
      .send({
        licenseTypeId: 'not-a-uuid',
        licenseExpiresAt: 'invalid-date',
      })
      .expect(400);

    expect(submitDriverApplicationUseCase.execute).not.toHaveBeenCalled();
  });
});
