import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  AccountStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
  ReportStatus,
} from '@saferidepro/shared-types';

import { CurrentUserContext } from '../../../src/modules/auth/application/types/current-user-context.type';
import { CreateReportUseCase } from '../../../src/modules/reports/application/use-cases/create-report.use-case';
import { GetReportEvidenceUseCase } from '../../../src/modules/reports/application/use-cases/get-report-evidence.use-case';
import { ListMyReportsUseCase } from '../../../src/modules/reports/application/use-cases/list-my-reports.use-case';
import { ListReviewableReportsUseCase } from '../../../src/modules/reports/application/use-cases/list-reviewable-reports.use-case';
import { ReviewReportUseCase } from '../../../src/modules/reports/application/use-cases/review-report.use-case';
import { UploadReportEvidenceUseCase } from '../../../src/modules/reports/application/use-cases/upload-report-evidence.use-case';
import { ReportsController } from '../../../src/modules/reports/presentation/controllers/reports.controller';
import { createAuthenticatedHttpContext } from '../../helpers/create-authenticated-http-context';
import { createHttpTestApp } from '../../helpers/create-test-app';

describe('ReportsController HTTP', () => {
  let app: INestApplication;
  const createReportUseCase = {
    execute: jest.fn(),
  };
  const uploadReportEvidenceUseCase = {
    execute: jest.fn(),
  };
  const listMyReportsUseCase = {
    execute: jest.fn(),
  };
  const listReviewableReportsUseCase = {
    execute: jest.fn(),
  };
  const getReportEvidenceUseCase = {
    execute: jest.fn(),
  };
  const reviewReportUseCase = {
    execute: jest.fn(),
  };

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
      controllers: [ReportsController],
      providers: [
        {
          provide: CreateReportUseCase,
          useValue: createReportUseCase,
        },
        {
          provide: UploadReportEvidenceUseCase,
          useValue: uploadReportEvidenceUseCase,
        },
        {
          provide: ListMyReportsUseCase,
          useValue: listMyReportsUseCase,
        },
        {
          provide: ListReviewableReportsUseCase,
          useValue: listReviewableReportsUseCase,
        },
        {
          provide: GetReportEvidenceUseCase,
          useValue: getReportEvidenceUseCase,
        },
        {
          provide: ReviewReportUseCase,
          useValue: reviewReportUseCase,
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

  it('creates a report through HTTP using the authenticated user id', async () => {
    createReportUseCase.execute.mockResolvedValue({
      message: 'Reporte registrado correctamente.',
      report: {
        id: 'report-1',
        status: ReportStatus.Pending,
      },
    });

    const response = await request(app.getHttpServer())
      .post('/api/reports')
      .set('Authorization', 'Bearer test-token')
      .send({
        tripId: '8fe59d21-01aa-4764-b9f5-fa05a13997e4',
        reportedMembershipId: '7cd59d21-01aa-4764-b9f5-fa05a13997e5',
        reason: 'UNSAFE_DRIVING',
        description: 'Conduccion brusca en una curva',
      })
      .expect(201);

    expect(response.body).toEqual({
      message: 'Reporte registrado correctamente.',
      report: {
        id: 'report-1',
        status: ReportStatus.Pending,
      },
    });
    expect(createReportUseCase.execute).toHaveBeenCalledWith({
      userId: 'admin-1',
      tripId: '8fe59d21-01aa-4764-b9f5-fa05a13997e4',
      reportedMembershipId: '7cd59d21-01aa-4764-b9f5-fa05a13997e5',
      reason: 'UNSAFE_DRIVING',
      description: 'Conduccion brusca en una curva',
      evidenceFileKey: undefined,
    });
  });

  it('uploads report evidence through HTTP using the authenticated user id', async () => {
    uploadReportEvidenceUseCase.execute.mockResolvedValue({
      message: 'La evidencia del reporte se cargo correctamente.',
      fileKey: 'membership-admin/evidence-1.png',
    });

    const response = await request(app.getHttpServer())
      .post('/api/reports/me/evidence')
      .set('Authorization', 'Bearer test-token')
      .attach('file', Buffer.from('image-content'), {
        filename: 'evidencia.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(response.body).toEqual({
      message: 'La evidencia del reporte se cargo correctamente.',
      fileKey: 'membership-admin/evidence-1.png',
    });
    expect(uploadReportEvidenceUseCase.execute).toHaveBeenCalledWith(
      'admin-1',
      expect.objectContaining({
        originalname: 'evidencia.png',
        mimetype: 'image/png',
      }),
    );
  });

  it('lists reports for the authenticated user', async () => {
    listMyReportsUseCase.execute.mockResolvedValue({
      items: [],
    });

    await request(app.getHttpServer())
      .get('/api/reports/me')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(listMyReportsUseCase.execute).toHaveBeenCalledWith('admin-1');
  });

  it('lists the review inbox using transformed query filters', async () => {
    listReviewableReportsUseCase.execute.mockResolvedValue({
      items: [],
    });

    await request(app.getHttpServer())
      .get('/api/reports/inbox')
      .set('Authorization', 'Bearer test-token')
      .query({
        institutionId: '8fe59d21-01aa-4764-b9f5-fa05a13997e4',
        status: ReportStatus.Pending,
        limit: '25',
      })
      .expect(200);

    expect(listReviewableReportsUseCase.execute).toHaveBeenCalledWith({
      currentUser: expect.objectContaining({
        id: 'admin-1',
      }),
      institutionId: '8fe59d21-01aa-4764-b9f5-fa05a13997e4',
      status: ReportStatus.Pending,
      limit: 25,
    });
  });

  it('downloads report evidence through HTTP for authorized admins', async () => {
    getReportEvidenceUseCase.execute.mockResolvedValue({
      fileName: 'evidencia-reporte.pdf',
      mimeType: 'application/pdf',
      content: Buffer.from('pdf-content'),
    });

    const response = await request(app.getHttpServer())
      .get('/api/reports/8fe59d21-01aa-4764-b9f5-fa05a13997e4/evidence')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(getReportEvidenceUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'admin-1',
      }),
      '8fe59d21-01aa-4764-b9f5-fa05a13997e4',
    );
    expect(response.header['content-type']).toContain('application/pdf');
    expect(response.header['content-disposition']).toContain('evidencia-reporte.pdf');
  });

  it('reviews a report through HTTP using the authenticated admin', async () => {
    reviewReportUseCase.execute.mockResolvedValue({
      message: 'Reporte revisado correctamente.',
      report: {
        id: 'report-1',
        status: ReportStatus.Resolved,
      },
    });

    await request(app.getHttpServer())
      .patch('/api/reports/8fe59d21-01aa-4764-b9f5-fa05a13997e4/review')
      .set('Authorization', 'Bearer test-token')
      .send({
        status: ReportStatus.Resolved,
        reviewNote: 'Caso atendido',
      })
      .expect(200);

    expect(reviewReportUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'admin-1',
      }),
      {
        reportId: '8fe59d21-01aa-4764-b9f5-fa05a13997e4',
        status: ReportStatus.Resolved,
        reviewNote: 'Caso atendido',
      },
    );
  });

  it('rejects invalid report review payloads before reaching the use case', async () => {
    await request(app.getHttpServer())
      .patch('/api/reports/8fe59d21-01aa-4764-b9f5-fa05a13997e4/review')
      .set('Authorization', 'Bearer test-token')
      .send({
        status: 'INVALID_STATUS',
      })
      .expect(400);

    expect(reviewReportUseCase.execute).not.toHaveBeenCalled();
  });
});
