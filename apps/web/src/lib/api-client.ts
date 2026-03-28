const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3002/api';

type HttpMethod = 'GET' | 'POST' | 'PATCH';

type ApiRequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  accessToken?: string;
  searchParams?: Record<string, string | undefined>;
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

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const headers = new Headers({
    'Content-Type': 'application/json',
  });

  if (options.accessToken) {
    headers.set('Authorization', `Bearer ${options.accessToken}`);
  }

  const requestUrl = new URL(`${API_BASE_URL}${path}`);

  for (const [key, value] of Object.entries(options.searchParams ?? {})) {
    if (value) {
      requestUrl.searchParams.set(key, value);
    }
  }

  const response = await fetch(requestUrl.toString(), {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  const responseData = (await response.json().catch(() => null)) as T | ApiErrorPayload | null;

  if (!response.ok) {
    throw new ApiError(
      extractErrorMessage(responseData) ?? 'No fue posible completar la solicitud.',
      response.status,
    );
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

