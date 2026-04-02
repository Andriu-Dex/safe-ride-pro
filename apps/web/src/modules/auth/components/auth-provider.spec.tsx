'use client';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import {
  AccountStatus,
  DocumentType,
  GlobalUserRole,
  UserOnboardingStatus,
} from '@saferidepro/shared-types';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { useAuth } from '../hooks/use-auth';
import { AuthProvider } from './auth-provider';
import * as authApi from '../lib/auth-api';
import * as authStorage from '../lib/auth-storage';
import type { AuthSession } from '../types/auth-session';

vi.mock('../lib/auth-api', () => ({
  createSession: vi.fn(),
  getCurrentUser: vi.fn(),
  logout: vi.fn(),
  refreshSession: vi.fn(),
}));

function AuthProbe() {
  const { authSession, isHydrated, signIn, signOut, refreshSession } = useAuth();

  return (
    <div>
      <div data-testid="hydrated">{String(isHydrated)}</div>
      <div data-testid="user-name">{authSession?.user.fullName ?? 'SIN_SESION'}</div>
      <button
        onClick={() =>
          signIn({
            email: 'admin@uta.edu.ec',
            password: 'Admin12345',
          })
        }
        type="button"
      >
        Iniciar
      </button>
      <button onClick={() => signOut()} type="button">
        Salir
      </button>
      <button onClick={() => refreshSession()} type="button">
        Refrescar
      </button>
    </div>
  );
}

function createTestSession(overrides?: Partial<AuthSession>): AuthSession {
  return {
    accessToken: overrides?.accessToken ?? 'token-123',
    refreshToken: overrides?.refreshToken ?? 'refresh-token-123',
    user: {
      id: 'user-1',
      email: 'admin@uta.edu.ec',
      fullName: 'Admin Temporal',
      career: null,
      phone: null,
      referenceNeighborhood: null,
      documentType: DocumentType.NationalId,
      documentNumber: '0123456789',
      profilePhotoUrl: null,
      globalRole: GlobalUserRole.SuperAdmin,
      accountStatus: AccountStatus.Active,
      emailVerifiedAt: '2026-03-29T00:00:00.000Z',
      termsAcceptedAt: null,
      privacyAcceptedAt: null,
      safetyRulesAcceptedAt: null,
      onboardingCompletedAt: null,
      onboardingStatus: UserOnboardingStatus.Incomplete,
      missingOnboardingRequirements: [],
      requiresOnboarding: false,
      memberships: [],
      ...(overrides?.user ?? {}),
    },
  };
}

function StorageWriter({ session }: { session: AuthSession }) {
  useEffect(() => {
    authStorage.writeStoredSession(session);
  }, [session]);

  return null;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('hydrates the session from storage and refreshes the user', async () => {
    authStorage.writeStoredSession(
      createTestSession({
        accessToken: 'stored-token',
        user: {
          ...createTestSession().user,
          fullName: 'Temporal',
        },
      }),
    );

    vi.mocked(authApi.getCurrentUser).mockResolvedValue({
      ...createTestSession().user,
      fullName: 'Admin Hidratado',
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('hydrated')).toHaveTextContent('true');
    });

    expect(authApi.getCurrentUser).toHaveBeenCalledWith('stored-token');
    expect(screen.getByTestId('user-name')).toHaveTextContent('Admin Hidratado');
  });

  it('signs in, stores the session and signs out correctly', async () => {
    const session = createTestSession({
      accessToken: 'fresh-token',
      user: {
        ...createTestSession().user,
        fullName: 'Admin Nuevo',
      },
    });

    vi.mocked(authApi.createSession).mockResolvedValue(session);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTestId('hydrated')).toHaveTextContent('true');
    });

    await user.click(screen.getByRole('button', { name: 'Iniciar' }));

    await waitFor(() => {
      expect(screen.getByTestId('user-name')).toHaveTextContent('Admin Nuevo');
    });

    expect(authStorage.readStoredSession()).toEqual(session);

    await user.click(screen.getByRole('button', { name: 'Salir' }));

    expect(screen.getByTestId('user-name')).toHaveTextContent('SIN_SESION');
    expect(authStorage.readStoredSession()).toBeNull();
  });

  it('refreshes the current session user', async () => {
    const initialSession = createTestSession({
      accessToken: 'refresh-token',
      user: {
        ...createTestSession().user,
        fullName: 'Antes de refrescar',
      },
    });

    vi.mocked(authApi.getCurrentUser).mockResolvedValue({
      ...createTestSession().user,
      fullName: 'Despues de refrescar',
    });

    render(
      <AuthProvider>
        <StorageWriter session={initialSession} />
        <AuthProbe />
      </AuthProvider>,
    );

    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTestId('hydrated')).toHaveTextContent('true');
    });

    await user.click(screen.getByRole('button', { name: 'Refrescar' }));

    await waitFor(() => {
      expect(screen.getByTestId('user-name')).toHaveTextContent('Despues de refrescar');
    });
  });
});
