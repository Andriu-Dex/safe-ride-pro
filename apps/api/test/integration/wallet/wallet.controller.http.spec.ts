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
import { WalletService } from '../../../src/modules/wallet/application/services/wallet.service';
import { WalletController } from '../../../src/modules/wallet/presentation/controllers/wallet.controller';
import { createAuthenticatedHttpContext } from '../../helpers/create-authenticated-http-context';
import { createHttpTestApp } from '../../helpers/create-test-app';

describe('WalletController HTTP', () => {
  let app: INestApplication;
  const walletService = {
    getWallet: jest.fn(),
    createTopUp: jest.fn(),
    captureTopUp: jest.fn(),
    refreshTopUp: jest.fn(),
  };

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
      controllers: [WalletController],
      providers: [
        { provide: WalletService, useValue: walletService },
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

  it('returns the wallet for the authenticated user', async () => {
    walletService.getWallet.mockResolvedValue({
      availableAmount: 20,
      retainedAmount: 0,
    });

    await request(app.getHttpServer())
      .get('/api/wallet')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(walletService.getWallet).toHaveBeenCalledWith('user-1');
  });

  it('creates a wallet top-up', async () => {
    walletService.createTopUp.mockResolvedValue({
      id: 'topup-1',
      amount: 15,
    });

    const response = await request(app.getHttpServer())
      .post('/api/wallet/top-ups')
      .set('Authorization', 'Bearer test-token')
      .send({
        amount: 15,
      })
      .expect(201);

    expect(response.body).toEqual({
      id: 'topup-1',
      amount: 15,
    });
    expect(walletService.createTopUp).toHaveBeenCalledWith('user-1', 15);
  });

  it('rejects invalid top-up payloads before reaching the service', async () => {
    await request(app.getHttpServer())
      .post('/api/wallet/top-ups')
      .set('Authorization', 'Bearer test-token')
      .send({
        amount: 0,
      })
      .expect(400);

    expect(walletService.createTopUp).not.toHaveBeenCalled();
  });

  it('captures a top-up by id', async () => {
    walletService.captureTopUp.mockResolvedValue({
      id: 'topup-1',
      status: 'CAPTURED',
    });

    await request(app.getHttpServer())
      .post('/api/wallet/top-ups/topup-1/capture')
      .set('Authorization', 'Bearer test-token')
      .expect(201);

    expect(walletService.captureTopUp).toHaveBeenCalledWith('user-1', 'topup-1');
  });

  it('refreshes a top-up status by id', async () => {
    walletService.refreshTopUp.mockResolvedValue({
      id: 'topup-1',
      status: 'PENDING',
    });

    await request(app.getHttpServer())
      .post('/api/wallet/top-ups/topup-1/refresh-status')
      .set('Authorization', 'Bearer test-token')
      .expect(201);

    expect(walletService.refreshTopUp).toHaveBeenCalledWith('user-1', 'topup-1');
  });
});
