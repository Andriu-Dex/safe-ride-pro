import { spawnSync } from 'node:child_process';
import path from 'node:path';

type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    memberships: Array<{
      id: string;
      institutionId: string;
      institutionName: string;
      role: string;
    }>;
  };
};

type RegisterResponse = {
  message: string;
  verificationCode: string;
  user: {
    id: string;
    email: string;
    fullName: string;
  };
};

type DriverOverviewResponse = {
  membership: {
    id: string;
    institutionId: string;
    institutionName: string;
    driverVerificationStatus: string;
  } | null;
};

type LicenseTypeCatalogItem = {
  id: string;
  code: string;
  name: string;
};

type VehicleMutationResponse = {
  message: string;
  vehicle: {
    id: string;
    plate: string;
  };
};

type TripMutationResponse = {
  message: string;
  trip: {
    id: string;
    originLabel: string;
    destinationLabel: string;
  };
};

const apiBaseUrl = process.env.E2E_API_BASE_URL ?? 'http://localhost:3001/api';
const seededAdminEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@uta.edu.ec';
const seededAdminPassword = process.env.E2E_ADMIN_PASSWORD ?? 'Admin12345';
const repoRoot = path.resolve(__dirname, '../../../..');

function createSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

function buildDocumentNumber(seed: string): string {
  const digits = seed.replace(/\D/g, '').padStart(6, '0').slice(-6);
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

async function apiRequest<T>(
  path: string,
  init: {
    method?: 'GET' | 'POST' | 'PATCH';
    accessToken?: string;
    body?: unknown;
  } = {},
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.accessToken ? { Authorization: `Bearer ${init.accessToken}` } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  const rawResponse = await response.text();
  const parsedResponse = rawResponse ? JSON.parse(rawResponse) : undefined;

  if (!response.ok) {
    const errorMessage =
      parsedResponse?.message ??
      `La solicitud ${path} fallo con codigo ${response.status}.`;

    throw new Error(errorMessage);
  }

  return parsedResponse as T;
}

function buildIsoDateFromMinutes(minutesFromNow: number): string {
  return new Date(Date.now() + minutesFromNow * 60_000).toISOString();
}

function finalizeE2EUserStateInQaDatabase(email: string): void {
  const escapedEmail = email.replace(/'/g, "''");
  const sql = `UPDATE users SET "emailVerifiedAt" = COALESCE("emailVerifiedAt", NOW()), "accountStatus" = 'ACTIVE', "career" = COALESCE(NULLIF(TRIM("career"), ''), 'Ingenieria QA'), "referenceNeighborhood" = COALESCE(NULLIF(TRIM("referenceNeighborhood"), ''), 'Ficoa'), "termsAcceptedAt" = COALESCE("termsAcceptedAt", NOW()), "privacyAcceptedAt" = COALESCE("privacyAcceptedAt", NOW()), "safetyRulesAcceptedAt" = COALESCE("safetyRulesAcceptedAt", NOW()), "onboardingCompletedAt" = COALESCE("onboardingCompletedAt", NOW()) WHERE email = '${escapedEmail}';`;

  const commandResult = spawnSync(
    'docker',
    [
      'compose',
      '--env-file',
      '.env.qa',
      '-f',
      'docker-compose.qa.yml',
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'postgres',
      '-d',
      'safe_ride_pro_qa',
      '-c',
      sql,
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      shell: false,
    },
  );

  if (commandResult.status !== 0) {
    throw new Error(
      commandResult.stderr?.trim()
      || 'No fue posible completar el estado onboarding/verificacion del usuario E2E.',
    );
  }
}

export async function loginSeedAdmin(): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: {
      email: seededAdminEmail,
      password: seededAdminPassword,
    },
  });
}

export async function registerVerifiedUser(prefix: string): Promise<{
  email: string;
  password: string;
  fullName: string;
  userId: string;
  membershipId: string;
  accessToken: string;
}> {
  const suffix = createSuffix();
  const email = `${prefix}-${suffix}@uta.edu.ec`;
  const password = 'UserPass123!';
  const fullName = `Usuario ${prefix} ${suffix}`;

  const registerResponse = await apiRequest<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: {
      email,
      password,
      fullName,
      phone: '0999999999',
      documentType: 'NATIONAL_ID',
      documentNumber: buildDocumentNumber(suffix),
    },
  });

  if (registerResponse.verificationCode) {
    await apiRequest('/auth/verify-email', {
      method: 'POST',
      body: {
        code: registerResponse.verificationCode,
      },
    });
  }

  finalizeE2EUserStateInQaDatabase(email);

  const loginResponse = await apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: {
      email,
      password,
    },
  });

  return {
    email,
    password,
    fullName,
    userId: loginResponse.user.id,
    membershipId: loginResponse.user.memberships[0].id,
    accessToken: loginResponse.accessToken,
  };
}

export async function submitDriverApplication(accessToken: string, suffix: string): Promise<void> {
  const licenseTypes = await apiRequest<LicenseTypeCatalogItem[]>('/vehicles/catalogs/license-types', {
    accessToken,
  });

  await apiRequest('/drivers/application', {
    method: 'POST',
    accessToken,
    body: {
      licenseTypeId: licenseTypes[0].id,
      licenseNumber: `LIC-${suffix}`.toUpperCase(),
      licenseExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      identityDocumentFileKey: `identity-${suffix}`,
      licenseDocumentFileKey: `license-${suffix}`,
    },
  });
}

export async function approveDriverApplication(adminAccessToken: string, membershipId: string): Promise<void> {
  await apiRequest(`/drivers/applications/${membershipId}/review`, {
    method: 'PATCH',
    accessToken: adminAccessToken,
    body: {
      decision: 'APPROVED',
      reviewNotes: 'Aprobado automaticamente para pruebas E2E.',
    },
  });
}

export async function getDriverOverview(accessToken: string): Promise<DriverOverviewResponse> {
  return apiRequest<DriverOverviewResponse>('/drivers/me', {
    accessToken,
  });
}

export async function registerVehicle(accessToken: string, suffix: string): Promise<VehicleMutationResponse> {
  return apiRequest<VehicleMutationResponse>('/vehicles', {
    method: 'POST',
    accessToken,
    body: {
      vehicleType: 'CAR',
      customBrandName: `Marca E2E ${suffix}`,
      customModelName: `Modelo E2E ${suffix}`,
      year: 2025,
      color: 'Azul',
      plate: `E${suffix.replace(/[^0-9]/g, '').slice(-6).padStart(6, '0')}`,
      seatCount: 4,
      luggagePolicy: 'SMALL_ONLY',
      registrationDocumentFileKey: `registration-${suffix}`,
    },
  });
}

export async function createPublishedTrip(accessToken: string, vehicleId: string, suffix: string): Promise<TripMutationResponse> {
  const tripResponse = await apiRequest<TripMutationResponse>('/trips', {
    method: 'POST',
    accessToken,
    body: {
      vehicleId,
      routeMode: 'DIRECT_ROUTE',
      originLabel: `Origen E2E ${suffix}`,
      destinationLabel: `Destino E2E ${suffix}`,
      originLatitude: -1.24908,
      originLongitude: -78.61675,
      destinationLatitude: -1.26184,
      destinationLongitude: -78.62089,
      departureAt: buildIsoDateFromMinutes(10),
      estimatedArrivalAt: buildIsoDateFromMinutes(40),
      seatCount: 2,
      basePriceReference: 2.5,
      notes: `Viaje E2E ${suffix}`,
    },
  });

  await apiRequest(`/trips/${tripResponse.trip.id}/publish`, {
    method: 'PATCH',
    accessToken,
  });

  return tripResponse;
}
