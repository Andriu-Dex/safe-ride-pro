import { apiRequest, ApiError } from '../../../lib/api-client';
import type {
  AuthSession,
  AuthTokens,
  AuthUser,
  LoginInput,
  RegisterInput,
} from '../types/auth-session';

export { ApiError };

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
};

export type RegisterResponse = {
  message: string;
  deliveryChannel: 'email' | 'development_preview';
  verificationCode?: string;
  user: {
    id: string;
    email: string;
    fullName: string;
  };
};

export type VerifyEmailResponse = {
  message: string;
  accessToken: string;
  refreshToken: string;
};

export type ResendVerificationCodeResponse = {
  message: string;
  deliveryChannel?: 'email' | 'development_preview';
  verificationCode?: string;
};

export type ForgotPasswordResponse = {
  message: string;
  deliveryChannel?: 'email' | 'development_preview';
  resetCode?: string;
};

export type ResetPasswordResponse = {
  message: string;
};

export type RefreshSessionResponse = {
  accessToken: string;
  refreshToken: string;
};

export type LogoutResponse = {
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

export async function createSessionFromTokens(tokens: AuthTokens): Promise<AuthSession> {
  const user = await getCurrentUser(tokens.accessToken);

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user,
  };
}

export async function resendVerificationCode(
  email: string,
): Promise<ResendVerificationCodeResponse> {
  return apiRequest<ResendVerificationCodeResponse>('/auth/resend-verification-code', {
    method: 'POST',
    body: {
      email,
    },
  });
}

export async function forgotPassword(email: string): Promise<ForgotPasswordResponse> {
  return apiRequest<ForgotPasswordResponse>('/auth/forgot-password', {
    method: 'POST',
    body: {
      email,
    },
  });
}

export async function resetPassword(
  code: string,
  password: string,
): Promise<ResetPasswordResponse> {
  return apiRequest<ResetPasswordResponse>('/auth/reset-password', {
    method: 'POST',
    body: {
      code,
      password,
    },
  });
}

export async function refreshSession(
  refreshToken: string,
): Promise<RefreshSessionResponse> {
  return apiRequest<RefreshSessionResponse>('/auth/refresh', {
    method: 'POST',
    body: {
      refreshToken,
    },
  });
}

export async function logout(refreshToken: string): Promise<LogoutResponse> {
  return apiRequest<LogoutResponse>('/auth/logout', {
    method: 'POST',
    body: {
      refreshToken,
    },
  });
}

export async function createSession(input: LoginInput): Promise<AuthSession> {
  const { accessToken, refreshToken } = await login(input);
  const user = await getCurrentUser(accessToken);

  return {
    accessToken,
    refreshToken,
    user,
  };
}

