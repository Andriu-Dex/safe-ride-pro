import type { AuthSession, AuthUser, LoginInput } from '../types/auth-session';
import { ApiError, apiRequest } from '../../../lib/api-client';

export { ApiError };

type LoginResponse = {
  accessToken: string;
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

export async function createSession(input: LoginInput): Promise<AuthSession> {
  const { accessToken } = await login(input);
  const user = await getCurrentUser(accessToken);

  return {
    accessToken,
    user,
  };
}

