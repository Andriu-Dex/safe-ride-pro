type JwtPayload = {
  exp?: number;
};

function decodeBase64Url(value: string): string | null {
  try {
    const normalizedValue = value.replace(/-/g, '+').replace(/_/g, '/');
    const paddingLength = (4 - (normalizedValue.length % 4)) % 4;
    const paddedValue = normalizedValue + '='.repeat(paddingLength);

    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      return window.atob(paddedValue);
    }

    return Buffer.from(paddedValue, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

function readJwtPayload(token: string): JwtPayload | null {
  const [, payloadSegment] = token.split('.');

  if (!payloadSegment) {
    return null;
  }

  const decodedPayload = decodeBase64Url(payloadSegment);

  if (!decodedPayload) {
    return null;
  }

  try {
    return JSON.parse(decodedPayload) as JwtPayload;
  } catch {
    return null;
  }
}

export function getTokenExpirationTime(token: string): number | null {
  const payload = readJwtPayload(token);

  if (!payload?.exp || Number.isNaN(payload.exp)) {
    return null;
  }

  return payload.exp * 1000;
}

export function getMillisecondsUntilTokenExpiry(token: string): number | null {
  const expirationTime = getTokenExpirationTime(token);

  if (!expirationTime) {
    return null;
  }

  return expirationTime - Date.now();
}

export function isTokenExpired(token: string): boolean {
  const millisecondsUntilExpiry = getMillisecondsUntilTokenExpiry(token);

  if (millisecondsUntilExpiry === null) {
    return false;
  }

  return millisecondsUntilExpiry <= 0;
}
