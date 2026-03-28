import type { AuthSession, AuthUser, LoginInput } from '../types/auth-session';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3002/api';

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  accessToken?: string;
};

type ApiErrorPayload = {
  message?: string | string[];
  error?: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const headers = new Headers({
    'Content-Type': 'application/json',
  });

  if (options.accessToken) {
    headers.set('Authorization', `Bearer ${options.accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  const responseData = (await response.json().catch(() => null)) as T | ApiErrorPayload | null;

  if (!response.ok) {
    const message = extractErrorMessage(responseData) ?? 'No fue posible completar la solicitud.';
    throw new ApiError(message, response.status);
  }

  return responseData as T;
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const typedPayload = payload as ApiErrorPayload;

  if (Array.isArray(typedPayload.message)) {
    return typedPayload.message[0] ?? null;
  }

  if (typeof typedPayload.message === 'string') {
    return typedPayload.message;
  }

  if (typeof typedPayload.error === 'string') {
    return typedPayload.error;
  }

  return null;
}

type LoginResponse = {
  accessToken: string;
};

export async function login(input: LoginInput): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: input,
  });
}

export async function getCurrentUser(accessToken: string): Promise<AuthUser> {
  return request<AuthUser>('/users/me', {
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
