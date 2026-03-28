import type { INestApplication } from '@nestjs/common';
import { DocumentType } from '@saferidepro/shared-types';
import request from 'supertest';

type RegisterUserInput = {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  documentNumber: string;
  studentCode: string;
};

export async function registerUser(
  app: INestApplication,
  input: RegisterUserInput,
) {
  return request(app.getHttpServer())
    .post('/api/auth/register')
    .send({
      email: input.email,
      password: input.password,
      fullName: input.fullName,
      phone: input.phone ?? '0999999999',
      documentType: DocumentType.NationalId,
      documentNumber: input.documentNumber,
      studentCode: input.studentCode,
    })
    .expect(201);
}

export async function verifyUserEmail(app: INestApplication, token: string) {
  return request(app.getHttpServer())
    .post('/api/auth/verify-email')
    .send({ token })
    .expect(201);
}

export async function loginUser(
  app: INestApplication,
  email: string,
  password: string,
) {
  return request(app.getHttpServer())
    .post('/api/auth/login')
    .send({
      email,
      password,
    })
    .expect(201);
}

export async function registerVerifyAndLoginUser(
  app: INestApplication,
  input: RegisterUserInput,
) {
  const registrationResponse = await registerUser(app, input);
  const verificationToken = registrationResponse.body.verificationToken as string;

  await verifyUserEmail(app, verificationToken);

  const loginResponse = await loginUser(app, input.email, input.password);

  return {
    registration: registrationResponse.body,
    login: loginResponse.body,
  };
}

export async function loginSeedAdmin(app: INestApplication) {
  const adminEmail = process.env.SUPER_ADMIN_EMAIL?.trim() || 'admin@uta.edu.ec';
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD?.trim() || 'ChangeMe123!';

  return loginUser(app, adminEmail, adminPassword);
}
