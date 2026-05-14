import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../../src/shared/infrastructure/database/prisma.service';
import request from 'supertest';

import { createRealDbTestApp } from '../helpers/create-real-db-test-app';
import {
  loginSeedAdmin,
  registerVerifyAndLoginUser,
} from '../helpers/auth-flow.helpers';

describe('Institutions real DB integration', () => {
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

  it('lists active institutions, creates a new institution and enables registration by its domain', async () => {
    const uniqueSuffix = Date.now().toString();
    const institutionName = `Universidad Sierra ${uniqueSuffix.slice(-4)}`;
    const institutionCode = `US${uniqueSuffix.slice(-4)}`;
    const primaryDomain = `sierra${uniqueSuffix.slice(-4)}.edu.ec`;
    const secondaryDomain = `mail.sierra${uniqueSuffix.slice(-4)}.edu.ec`;
    const adminSession = await loginSeedAdmin(app);

    const initialListResponse = await request(app.getHttpServer())
      .get('/api/institutions')
      .expect(200);

    expect(
      initialListResponse.body.some(
        (institution: { code: string }) => institution.code === 'UTA',
      ),
    ).toBe(true);

    const createInstitutionResponse = await request(app.getHttpServer())
      .post('/api/institutions')
      .set('Authorization', `Bearer ${adminSession.body.accessToken as string}`)
      .send({
        name: `  ${institutionName}  `,
        code: `  ${institutionCode.toLowerCase()}  `,
        domains: [` ${primaryDomain.toUpperCase()} `, ` ${secondaryDomain} `],
      })
      .expect(201);

    expect(createInstitutionResponse.body).toMatchObject({
      name: institutionName,
      code: institutionCode,
      domains: [primaryDomain, secondaryDomain],
    });

    const storedInstitution = await prisma.institution.findUnique({
      where: { code: institutionCode },
      include: {
        domains: {
          orderBy: [{ isPrimary: 'desc' }, { domain: 'asc' }],
        },
      },
    });

    expect(storedInstitution).not.toBeNull();
    expect(storedInstitution?.domains.map((domain) => domain.domain)).toEqual([
      primaryDomain,
      secondaryDomain,
    ]);

    const registeredUser = await registerVerifyAndLoginUser(app, {
      email: `student.${uniqueSuffix}@${primaryDomain}`,
      password: 'Institution123!',
      fullName: 'Estudiante Nueva Institucion',
      documentNumber: `21${uniqueSuffix.slice(-8)}`,
      studentCode: `INS-${uniqueSuffix.slice(-6)}`,
    });

    const userProfileResponse = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${registeredUser.login.accessToken as string}`)
      .expect(200);

    expect(userProfileResponse.body.memberships).toHaveLength(1);
    expect(userProfileResponse.body.memberships[0].institutionName).toBe(institutionName);

    const nonAdminCreateResponse = await request(app.getHttpServer())
      .post('/api/institutions')
      .set('Authorization', `Bearer ${registeredUser.login.accessToken as string}`)
      .send({
        name: 'Institucion No Permitida',
        code: `NP${uniqueSuffix.slice(-4)}`,
        domains: [`np${uniqueSuffix.slice(-4)}.edu.ec`],
      })
      .expect(403);

    expect(nonAdminCreateResponse.body.message).toBe(
      'Esta accion requiere privilegios de SUPER_ADMIN.',
    );
  });

  it('suspends an institution and degrades an already open user session', async () => {
    const uniqueSuffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
    const shortSuffix = uniqueSuffix.slice(-6);
    const institutionName = `Institucion Suspendible ${shortSuffix}`;
    const institutionCode = `SP${shortSuffix}`;
    const primaryDomain = `suspendible${shortSuffix}.edu.ec`;
    const adminSession = await loginSeedAdmin(app);

    const createInstitutionResponse = await request(app.getHttpServer())
      .post('/api/institutions')
      .set('Authorization', `Bearer ${adminSession.body.accessToken as string}`)
      .send({
        name: institutionName,
        code: institutionCode,
        domains: [primaryDomain],
      })
      .expect(201);

    const institutionId = createInstitutionResponse.body.id as string;

    const registeredUser = await registerVerifyAndLoginUser(app, {
      email: `session.${uniqueSuffix}@${primaryDomain}`,
      password: 'Suspend123!',
      fullName: 'Usuario Suspendido',
      documentNumber: shortSuffix,
      studentCode: `SUS-${shortSuffix}`,
    });

    const accessToken = registeredUser.login.accessToken as string;

    const suspendResponse = await request(app.getHttpServer())
      .patch(`/api/institutions/${institutionId}/status`)
      .set('Authorization', `Bearer ${adminSession.body.accessToken as string}`)
      .send({
        isActive: false,
      })
      .expect(200);

    expect(suspendResponse.body.message).toBe('La institucion fue suspendida correctamente.');
    expect(suspendResponse.body.institution).toMatchObject({
      id: institutionId,
      isActive: false,
    });

    const currentUserResponse = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(currentUserResponse.body.memberships[0]).toMatchObject({
      institutionId,
      institutionIsActive: false,
    });

    const trustSummaryResponse = await request(app.getHttpServer())
      .get('/api/users/me/trust-summary')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);

    expect(trustSummaryResponse.body.message).toBe(
      'No tienes una membresia activa para consultar tu resumen de confianza.',
    );

    const activeInstitutionsResponse = await request(app.getHttpServer())
      .get('/api/institutions')
      .expect(200);

    expect(
      activeInstitutionsResponse.body.some(
        (institution: { id: string }) => institution.id === institutionId,
      ),
    ).toBe(false);

    const reactivateResponse = await request(app.getHttpServer())
      .patch(`/api/institutions/${institutionId}/status`)
      .set('Authorization', `Bearer ${adminSession.body.accessToken as string}`)
      .send({
        isActive: true,
      })
      .expect(200);

    expect(reactivateResponse.body.message).toBe('La institucion fue reactivada correctamente.');
    expect(reactivateResponse.body.institution).toMatchObject({
      id: institutionId,
      isActive: true,
    });
  });
});
