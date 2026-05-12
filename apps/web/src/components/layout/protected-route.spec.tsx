import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProtectedRoute } from './protected-route';

const replaceMock = vi.fn();
const useAuthMock = vi.fn();
const setExperienceModeMock = vi.fn();
let pathnameMock = '/viajes';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
  usePathname: () => pathnameMock,
}));

vi.mock('../../modules/auth/hooks/use-auth', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../../modules/auth/hooks/use-app-experience-mode', () => ({
  useAppExperienceMode: () => ({
    isDriverExperienceActive: false,
    setExperienceMode: setExperienceModeMock,
  }),
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathnameMock = '/viajes';
  });

  it('shows a loading state while the session is hydrating', () => {
    useAuthMock.mockReturnValue({
      authSession: null,
      isHydrated: false,
    });

    render(
      <ProtectedRoute>
        <div>Panel protegido</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText('Preparando tu panel inteligente')).toBeInTheDocument();
  });

  it('redirects unauthenticated users to login', async () => {
    useAuthMock.mockReturnValue({
      authSession: null,
      isHydrated: true,
    });

    render(
      <ProtectedRoute>
        <div>Panel protegido</div>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/login?next=%2Fviajes');
    });
  });

  it('renders the protected content when the session is valid', () => {
    useAuthMock.mockReturnValue({
      authSession: {
        accessToken: 'token',
        user: {
          id: 'user-1',
          email: 'admin@uta.edu.ec',
          fullName: 'Admin',
          career: null,
          phone: null,
          referenceNeighborhood: null,
          documentType: 'NATIONAL_ID',
          documentNumber: '1710034065',
          profilePhotoUrl: null,
          globalRole: 'SUPER_ADMIN',
          accountStatus: 'ACTIVE',
          emailVerifiedAt: '2026-04-02T10:00:00.000Z',
          termsAcceptedAt: '2026-04-02T10:00:00.000Z',
          privacyAcceptedAt: '2026-04-02T10:00:00.000Z',
          safetyRulesAcceptedAt: '2026-04-02T10:00:00.000Z',
          onboardingCompletedAt: '2026-04-02T10:00:00.000Z',
          onboardingStatus: 'COMPLETE',
          missingOnboardingRequirements: [],
          requiresOnboarding: false,
          memberships: [],
        },
      },
      isHydrated: true,
    });

    render(
      <ProtectedRoute>
        <div>Panel protegido</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText('Panel protegido')).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('redirects authenticated users with incomplete onboarding to perfil', async () => {
    useAuthMock.mockReturnValue({
      authSession: {
        accessToken: 'token',
        user: {
          id: 'user-1',
          email: 'admin@uta.edu.ec',
          fullName: 'Admin',
          career: null,
          phone: null,
          referenceNeighborhood: null,
          documentType: 'NATIONAL_ID',
          documentNumber: '1710034065',
          profilePhotoUrl: null,
          globalRole: 'SUPER_ADMIN',
          accountStatus: 'ACTIVE',
          emailVerifiedAt: '2026-04-02T10:00:00.000Z',
          termsAcceptedAt: null,
          privacyAcceptedAt: null,
          safetyRulesAcceptedAt: null,
          onboardingCompletedAt: null,
          onboardingStatus: 'INCOMPLETE',
          missingOnboardingRequirements: ['CAREER'],
          requiresOnboarding: true,
          memberships: [],
        },
      },
      isHydrated: true,
    });

    render(
      <ProtectedRoute>
        <div>Panel protegido</div>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/perfil?next=%2Fviajes');
    });
  });

  it('restores driver mode automatically for approved drivers on driver routes', async () => {
    pathnameMock = '/vehiculos';
    useAuthMock.mockReturnValue({
      authSession: {
        accessToken: 'token',
        user: {
          id: 'user-1',
          email: 'conductor@uta.edu.ec',
          fullName: 'Conductor',
          career: null,
          phone: null,
          referenceNeighborhood: null,
          documentType: 'NATIONAL_ID',
          documentNumber: '1710034065',
          profilePhotoUrl: null,
          globalRole: 'USER',
          accountStatus: 'ACTIVE',
          emailVerifiedAt: '2026-04-02T10:00:00.000Z',
          termsAcceptedAt: '2026-04-02T10:00:00.000Z',
          privacyAcceptedAt: '2026-04-02T10:00:00.000Z',
          safetyRulesAcceptedAt: '2026-04-02T10:00:00.000Z',
          onboardingCompletedAt: '2026-04-02T10:00:00.000Z',
          onboardingStatus: 'COMPLETE',
          missingOnboardingRequirements: [],
          requiresOnboarding: false,
          memberships: [
            {
              id: 'membership-driver',
              institutionId: 'institution-1',
              institutionName: 'UTA',
              institutionIsActive: true,
              role: 'STUDENT',
              membershipStatus: 'ACTIVE',
              studentCode: 'DRV001',
              isDefault: true,
              driverVerificationStatus: 'APPROVED',
              effectiveDriverVerificationStatus: 'APPROVED',
            },
          ],
        },
      },
      isHydrated: true,
    });

    render(
      <ProtectedRoute>
        <div>Panel protegido</div>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(setExperienceModeMock).toHaveBeenCalledWith('driver');
    });
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
