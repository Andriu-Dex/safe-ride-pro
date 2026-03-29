import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProtectedRoute } from './protected-route';

const replaceMock = vi.fn();
const useAuthMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
  usePathname: () => '/viajes',
}));

vi.mock('../../modules/auth/hooks/use-auth', () => ({
  useAuth: () => useAuthMock(),
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    expect(screen.getByText('Preparando tu panel')).toBeInTheDocument();
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
          globalRole: 'SUPER_ADMIN',
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
});
