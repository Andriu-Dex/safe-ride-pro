import type { INestApplication } from '@nestjs/common';
import { AccountStatus } from '@prisma/client';
import request from 'supertest';

import { AuditAction } from '../../../src/modules/audit/domain/audit.types';
import { PrismaService } from '../../../src/shared/infrastructure/database/prisma.service';
import { createRealDbTestApp } from '../helpers/create-real-db-test-app';
import { loginUser, registerUser, verifyUserEmail } from '../helpers/auth-flow.helpers';

describe('Auth real DB integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const testApp = await createRealDbTestApp();

    app = testApp.app;
    prisma = testApp.prisma;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('registers, verifies and logs in a user against the real database', async () => {
    const uniqueSuffix = Date.now().toString();
    const email = `auth.${uniqueSuffix}@uta.edu.ec`;
    const password = 'Password123!';
    const registrationResponse = await registerUser(app, {
      email,
      password,
      fullName: 'Estudiante Auth DB',
      documentNumber: `17${uniqueSuffix.slice(-8)}`,
      studentCode: `AUTH-${uniqueSuffix.slice(-6)}`,
    });

    expect(registrationResponse.body.message).toBe(
      'Cuenta creada correctamente. Verifica tu correo para activarla.',
    );
    expect(registrationResponse.body.user.email).toBe(email);
    expect(registrationResponse.body.verificationToken).toEqual(expect.any(String));

    const createdUser = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: true,
        emailVerificationCodes: true,
      },
    });

    expect(createdUser).not.toBeNull();
    expect(createdUser?.accountStatus).toBe(AccountStatus.PENDING_EMAIL_VERIFICATION);
    expect(createdUser?.emailVerifiedAt).toBeNull();
    expect(createdUser?.memberships).toHaveLength(1);
    expect(createdUser?.emailVerificationCodes).toHaveLength(1);

    await verifyUserEmail(app, registrationResponse.body.verificationToken as string);

    const verifiedUser = await prisma.user.findUnique({
      where: { email },
      include: {
        emailVerificationCodes: true,
      },
    });

    expect(verifiedUser?.accountStatus).toBe(AccountStatus.ACTIVE);
    expect(verifiedUser?.emailVerifiedAt).not.toBeNull();
    expect(verifiedUser?.emailVerificationCodes[0]?.verifiedAt).not.toBeNull();

    const loginResponse = await loginUser(app, email, password);
    const accessToken = loginResponse.body.accessToken as string;

    expect(accessToken).toEqual(expect.any(String));
    expect(loginResponse.body.user.email).toBe(email);
    expect(loginResponse.body.user.memberships).toHaveLength(1);

    const meResponse = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(meResponse.body.email).toBe(email);
    expect(meResponse.body.accountStatus).toBe('ACTIVE');

    const auditEvents = await prisma.auditEvent.findMany({
      where: {
        actorUserId: createdUser?.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    expect(auditEvents.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        AuditAction.AuthRegistered,
        AuditAction.AuthEmailVerified,
        AuditAction.AuthLoginSucceeded,
      ]),
    );
  });
});
