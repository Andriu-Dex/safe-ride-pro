import { apiRequest, ApiError } from '../../../lib/api-client';
import type { AuthSession, AuthUser, LoginInput, RegisterInput } from '../types/auth-session';

export { ApiError };

type LoginResponse = {
  accessToken: string;
};

export type RegisterResponse = {
  message: string;
  verificationCode: string;
  user: {
    id: string;
    email: string;
    fullName: string;
  };
};

export type VerifyEmailResponse = {
  message: string;
};

export async function login(input: LoginInput): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: input,
  });
}

export async function getCurrentUser(accessToken: string): Promise<AuthUser> {
  return apiRequest<AuthUser>('/users/me', {
    accessToken,
  });
}

export async function register(input: RegisterInput): Promise<RegisterResponse> {
  return apiRequest<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: input,
  });
}

export async function verifyEmail(code: string): Promise<VerifyEmailResponse> {
  return apiRequest<VerifyEmailResponse>('/auth/verify-email', {
    method: 'POST',
    body: {
      code,
    },
  });
}

export async function createSession(input: LoginInput): Promise<AuthSession> {
  const { accessToken } = await login(input);
  const user = await getCurrentUser(accessToken);

  return {
    accessToken,
    user,
  };
}

