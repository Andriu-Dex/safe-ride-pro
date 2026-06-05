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
import { CapturePaymentUseCase } from '../../../src/modules/payments/application/use-cases/capture-payment.use-case';
import { ConfirmCashPaymentUseCase } from '../../../src/modules/payments/application/use-cases/confirm-cash-payment.use-case';
import { CreatePaymentCheckoutLinkUseCase } from '../../../src/modules/payments/application/use-cases/create-payment-checkout-link.use-case';
import { RefreshPaymentStatusUseCase } from '../../../src/modules/payments/application/use-cases/refresh-payment-status.use-case';
import { ReportCashPaymentIssueUseCase } from '../../../src/modules/payments/application/use-cases/report-cash-payment-issue.use-case';
import { PaymentsController } from '../../../src/modules/payments/presentation/controllers/payments.controller';
import { createAuthenticatedHttpContext } from '../../helpers/create-authenticated-http-context';
import { createHttpTestApp } from '../../helpers/create-test-app';

describe('PaymentsController HTTP', () => {
  let app: INestApplication;
  const capturePaymentUseCase = { execute: jest.fn() };
  const createPaymentCheckoutLinkUseCase = { execute: jest.fn() };
  const refreshPaymentStatusUseCase = { execute: jest.fn() };
  const confirmCashPaymentUseCase = { execute: jest.fn() };
  const reportCashPaymentIssueUseCase = { execute: jest.fn() };

  const authenticatedUser: CurrentUserContext = {
    id: 'user-1',
    email: 'student@uta.edu.ec',
    fullName: 'Usuario Uno',
    globalRole: GlobalUserRole.User,
    accountStatus: AccountStatus.Active,
    memberships: [
      {
        id: 'membership-1',
        institutionId: 'institution-1',
        institutionName: 'UTA',
        role: InstitutionMembershipRole.Student,
        membershipStatus: MembershipStatus.Active,
        studentCode: 'UTA001',
        isDefault: true,
        driverVerificationStatus: DriverVerificationStatus.NotRequested,
      },
    ],
  };

  const authenticatedHttpContext = createAuthenticatedHttpContext(authenticatedUser);

  beforeAll(async () => {
    const testApp = await createHttpTestApp({
      controllers: [PaymentsController],
      providers: [
        { provide: CapturePaymentUseCase, useValue: capturePaymentUseCase },
        {
          provide: CreatePaymentCheckoutLinkUseCase,
          useValue: createPaymentCheckoutLinkUseCase,
        },
        { provide: RefreshPaymentStatusUseCase, useValue: refreshPaymentStatusUseCase },
        { provide: ConfirmCashPaymentUseCase, useValue: confirmCashPaymentUseCase },
        {
          provide: ReportCashPaymentIssueUseCase,
          useValue: reportCashPaymentIssueUseCase,
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

  it('creates a payment checkout link for the authenticated user', async () => {
    createPaymentCheckoutLinkUseCase.execute.mockResolvedValue({
      approvalUrl: 'https://paypal.test/approve',
    });

    const response = await request(app.getHttpServer())
      .post('/api/payments/payment-1/checkout-link')
      .set('Authorization', 'Bearer test-token')
      .expect(201);

    expect(response.body).toEqual({
      approvalUrl: 'https://paypal.test/approve',
    });
    expect(createPaymentCheckoutLinkUseCase.execute).toHaveBeenCalledWith(
      'user-1',
      'payment-1',
    );
  });

  it('refreshes a payment status', async () => {
    refreshPaymentStatusUseCase.execute.mockResolvedValue({
      status: 'PENDING',
    });

    await request(app.getHttpServer())
      .post('/api/payments/payment-1/refresh-status')
      .set('Authorization', 'Bearer test-token')
      .expect(201);

    expect(refreshPaymentStatusUseCase.execute).toHaveBeenCalledWith(
      'user-1',
      'payment-1',
    );
  });

  it('captures a payment', async () => {
    capturePaymentUseCase.execute.mockResolvedValue({
      status: 'CAPTURED',
    });

    await request(app.getHttpServer())
      .post('/api/payments/payment-1/capture')
      .set('Authorization', 'Bearer test-token')
      .expect(201);

    expect(capturePaymentUseCase.execute).toHaveBeenCalledWith('user-1', 'payment-1');
  });

  it('confirms a cash payment', async () => {
    confirmCashPaymentUseCase.execute.mockResolvedValue({
      status: 'CONFIRMED',
    });

    await request(app.getHttpServer())
      .post('/api/payments/payment-1/confirm-cash')
      .set('Authorization', 'Bearer test-token')
      .expect(201);

    expect(confirmCashPaymentUseCase.execute).toHaveBeenCalledWith('user-1', 'payment-1');
  });

  it('rejects invalid cash issue payloads before reaching the use case', async () => {
    await request(app.getHttpServer())
      .post('/api/payments/payment-1/report-cash-issue')
      .set('Authorization', 'Bearer test-token')
      .send({
        note: 'corta',
      })
      .expect(400);

    expect(reportCashPaymentIssueUseCase.execute).not.toHaveBeenCalled();
  });
});
