import type { INestApplication } from '@nestjs/common';
import { DocumentType } from '@saferidepro/shared-types';
import request from 'supertest';

type RegisterUserInput = {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  documentNumber: string;
  studentCode?: string;
};

function buildValidEcuadorianNationalId(seed: string): string {
  const digits = seed.replace(/\D/g, '').padEnd(6, '0').slice(0, 6);
  const baseDigits = `171${digits}`;
  const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2];

  const total = coefficients.reduce((sum, coefficient, index) => {
    let product = Number.parseInt(baseDigits.charAt(index), 10) * coefficient;

    if (product >= 10) {
      product -= 9;
    }

    return sum + product;
  }, 0);

  const verifierDigit = total % 10 === 0 ? 0 : 10 - (total % 10);

  return `${baseDigits}${verifierDigit}`;
}

export async function registerUser(
  app: INestApplication,
  input: RegisterUserInput,
): Promise<request.Response> {
  return request(app.getHttpServer())
    .post('/api/auth/register')
    .send({
      email: input.email,
      password: input.password,
      fullName: input.fullName,
      phone: input.phone ?? '0999999999',
      documentType: DocumentType.NationalId,
      documentNumber: buildValidEcuadorianNationalId(input.documentNumber),
      studentCode: input.studentCode,
    })
    .expect(201);
}

export async function verifyUserEmail(
  app: INestApplication,
  code: string,
): Promise<request.Response> {
  return request(app.getHttpServer())
    .post('/api/auth/verify-email')
    .send({ code })
    .expect(201);
}

export async function loginUser(
  app: INestApplication,
  email: string,
  password: string,
): Promise<request.Response> {
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
  const verificationCode = registrationResponse.body.verificationCode as string;

  await verifyUserEmail(app, verificationCode);

  const loginResponse = await loginUser(app, input.email, input.password);

  return {
    registration: registrationResponse.body,
    login: loginResponse.body,
  };
}

export async function loginSeedAdmin(app: INestApplication): Promise<request.Response> {
  const adminEmail = process.env.SUPER_ADMIN_EMAIL?.trim() || 'admin@uta.edu.ec';
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD?.trim() || 'ChangeMe123!';

  return loginUser(app, adminEmail, adminPassword);
}
