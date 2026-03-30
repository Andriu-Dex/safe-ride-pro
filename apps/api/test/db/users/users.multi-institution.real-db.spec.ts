import type { INestApplication } from '@nestjs/common';
import {
  DriverVerificationStatus,
  MembershipRole,
  MembershipStatus,
} from '@prisma/client';
import { PrismaService } from '../../../src/shared/infrastructure/database/prisma.service';
import request from 'supertest';

import { createRealDbTestApp } from '../helpers/create-real-db-test-app';
import {
  loginUser,
  registerVerifyAndLoginUser,
} from '../helpers/auth-flow.helpers';

describe('Users multi-institution real DB integration', () => {
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

  it('returns and preserves multiple memberships for the same global user', async () => {
    const uniqueSuffix = Date.now().toString();
    const secondaryInstitution = await prisma.institution.create({
      data: {
        name: `Instituto Andino ${uniqueSuffix.slice(-4)}`,
        code: `IA${uniqueSuffix.slice(-4)}`,
        domains: {
          create: [
            {
              domain: `andino${uniqueSuffix.slice(-4)}.edu.ec`,
              isPrimary: true,
              isActive: true,
            },
          ],
        },
      },
    });

    const session = await registerVerifyAndLoginUser(app, {
      email: `multi.${uniqueSuffix}@uta.edu.ec`,
      password: 'MultiPass123!',
      fullName: 'Usuario Multiinstitucional',
      documentNumber: `22${uniqueSuffix.slice(-8)}`,
      studentCode: `MUL-${uniqueSuffix.slice(-6)}`,
    });

    const userId = session.registration.user.id as string;

    await prisma.userInstitutionMembership.create({
      data: {
        userId,
        institutionId: secondaryInstitution.id,
        role: MembershipRole.STUDENT,
        membershipStatus: MembershipStatus.ACTIVE,
        studentCode: `AND-${uniqueSuffix.slice(-6)}`,
        isDefault: false,
        driverVerificationStatus: DriverVerificationStatus.NOT_REQUESTED,
      },
    });

    const reloginResponse = await loginUser(app, `multi.${uniqueSuffix}@uta.edu.ec`, 'MultiPass123!');
    const accessToken = reloginResponse.body.accessToken as string;

    expect(reloginResponse.body.user.memberships).toHaveLength(2);
    expect(reloginResponse.body.user.memberships[0].institutionName).toBe(
      'Universidad Tecnica de Ambato',
    );
    expect(
      reloginResponse.body.user.memberships.some(
        (membership: { institutionName: string }) =>
          membership.institutionName === secondaryInstitution.name,
      ),
    ).toBe(true);

    const currentUserResponse = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(currentUserResponse.body.memberships).toHaveLength(2);
    expect(currentUserResponse.body.memberships[0].isDefault).toBe(true);
    expect(
      currentUserResponse.body.memberships.find(
        (membership: { institutionName: string }) =>
          membership.institutionName === secondaryInstitution.name,
      ),
    ).toMatchObject({
      isDefault: false,
      membershipStatus: 'ACTIVE',
    });

    const updateResponse = await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        fullName: 'Usuario Multiinstitucional Actualizado',
        phone: '0987654321',
        profilePhotoUrl: 'https://example.com/profile.jpg',
      })
      .expect(200);

    expect(updateResponse.body.fullName).toBe('Usuario Multiinstitucional Actualizado');
    expect(updateResponse.body.phone).toBe('0987654321');
    expect(updateResponse.body.profilePhotoUrl).toBe('https://example.com/profile.jpg');
    expect(updateResponse.body.memberships).toHaveLength(2);

    const storedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            institution: true,
          },
          orderBy: [{ isDefault: 'desc' }, { joinedAt: 'asc' }],
        },
      },
    });

    expect(storedUser?.fullName).toBe('Usuario Multiinstitucional Actualizado');
    expect(storedUser?.phone).toBe('0987654321');
    expect(storedUser?.profilePhotoUrl).toBe('https://example.com/profile.jpg');
    expect(storedUser?.memberships).toHaveLength(2);
    expect(storedUser?.memberships[0]?.institution.code).toBe('UTA');
    expect(storedUser?.memberships[1]?.institutionId).toBe(secondaryInstitution.id);
  });

  it('uses an active membership from an active institution as operational fallback', async () => {
    const uniqueSuffix = `${Date.now()}-fallback`;
    const secondaryInstitution = await prisma.institution.create({
      data: {
        name: `Institucion Operativa ${uniqueSuffix.slice(-4)}`,
        code: `IO${uniqueSuffix.slice(-4)}`,
        domains: {
          create: [
            {
              domain: `operativa${uniqueSuffix.slice(-4)}.edu.ec`,
              isPrimary: true,
              isActive: true,
            },
          ],
        },
      },
    });

    const session = await registerVerifyAndLoginUser(app, {
      email: `fallback.${uniqueSuffix}@uta.edu.ec`,
      password: 'FallbackPass123!',
      fullName: 'Usuario Operativo',
      documentNumber: `${Date.now()}`.slice(-10),
      studentCode: `FBK-${uniqueSuffix.slice(-6)}`,
    });

    const userId = session.registration.user.id as string;
    const originalMembershipId = session.login.user.memberships[0].id as string;

    const secondaryMembership = await prisma.userInstitutionMembership.create({
      data: {
        userId,
        institutionId: secondaryInstitution.id,
        role: MembershipRole.STUDENT,
        membershipStatus: MembershipStatus.ACTIVE,
        studentCode: `OPS-${uniqueSuffix.slice(-6)}`,
        isDefault: false,
        driverVerificationStatus: DriverVerificationStatus.NOT_REQUESTED,
      },
    });

    await prisma.userInstitutionMembership.update({
      where: { id: originalMembershipId },
      data: {
        membershipStatus: MembershipStatus.INACTIVE,
      },
    });

    const reloginResponse = await loginUser(
      app,
      `fallback.${uniqueSuffix}@uta.edu.ec`,
      'FallbackPass123!',
    );
    const accessToken = reloginResponse.body.accessToken as string;

    const trustSummaryResponse = await request(app.getHttpServer())
      .get('/api/users/me/trust-summary')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(trustSummaryResponse.body.membershipId).toBe(secondaryMembership.id);
    expect(trustSummaryResponse.body.cancellationPolicy.lateWindowMinutes).toBe(30);
  });
});
