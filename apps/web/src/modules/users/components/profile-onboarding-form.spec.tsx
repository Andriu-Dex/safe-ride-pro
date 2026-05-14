import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AccountStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
  UserOnboardingStatus,
} from '@saferidepro/shared-types';

import { ProfileOnboardingForm } from './profile-onboarding-form';
import { updateCurrentUserProfile, uploadCurrentUserProfilePhoto } from '../lib/user-api';

const { persistToastMock } = vi.hoisted(() => ({
  persistToastMock: vi.fn(),
}));

const replaceMock = vi.fn();
const refreshSessionMock = vi.fn();
const authSessionMock = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  user: {
    id: 'user-1',
    email: 'user@uta.edu.ec',
    fullName: 'Usuario Uno',
    career: 'Software',
    phone: '0999999999',
    referenceNeighborhood: 'Ficoa',
    documentType: 'NATIONAL_ID',
    documentNumber: '1710034065',
    profilePhotoUrl: null,
    globalRole: GlobalUserRole.User,
    accountStatus: AccountStatus.Active,
    emailVerifiedAt: '2030-01-01T08:00:00.000Z',
    termsAcceptedAt: '2030-01-01T08:10:00.000Z',
    privacyAcceptedAt: '2030-01-01T08:10:00.000Z',
    safetyRulesAcceptedAt: '2030-01-01T08:10:00.000Z',
    onboardingCompletedAt: '2030-01-01T08:12:00.000Z',
    onboardingStatus: UserOnboardingStatus.Complete,
    missingOnboardingRequirements: [],
    requiresOnboarding: false,
    memberships: [
      {
        id: 'membership-1',
        institutionId: 'institution-1',
        institutionName: 'UTA',
        institutionIsActive: true,
        role: InstitutionMembershipRole.Student,
        membershipStatus: MembershipStatus.Active,
        studentCode: 'STU-001',
        isDefault: true,
        driverVerificationStatus: DriverVerificationStatus.NotRequested,
      },
    ],
  },
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
  useSearchParams: () => ({
    get: () => null,
  }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('../../auth/hooks/use-auth', () => ({
  useAuth: () => ({
    authSession: authSessionMock,
    refreshSession: refreshSessionMock,
  }),
}));

vi.mock('../lib/user-api', () => ({
  updateCurrentUserProfile: vi.fn(),
  uploadCurrentUserProfilePhoto: vi.fn(),
}));

vi.mock('../../../components/ui/flash-toast', () => ({
  persistToast: persistToastMock,
}));

describe('ProfileOnboardingForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:avatar-preview');
    URL.revokeObjectURL = vi.fn();
  });

  it('opens the edit modal, submits profile changes and shows a success toast', async () => {
    vi.mocked(updateCurrentUserProfile).mockResolvedValue({
      id: 'user-1',
    } as never);
    refreshSessionMock.mockResolvedValue(undefined);

    render(<ProfileOnboardingForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Editar perfil' }));

    const fullNameInput = screen.getByLabelText('Nombre completo');
    const careerInput = screen.getByLabelText('Carrera');
    const phoneInput = screen.getByLabelText('Celular');
    const neighborhoodInput = screen.getByLabelText('Zona o barrio de referencia');

    fireEvent.change(fullNameInput, { target: { value: 'Usuario Editado' } });
    fireEvent.change(careerInput, {
      target: { value: 'Tecnologias de la Informacion' },
    });
    fireEvent.change(phoneInput, { target: { value: '0988888888' } });
    fireEvent.change(neighborhoodInput, { target: { value: 'Miraflores' } });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(updateCurrentUserProfile).toHaveBeenCalledWith('access-token', {
        fullName: 'Usuario Editado',
        career: 'Tecnologias de la Informacion',
        phone: '0988888888',
        referenceNeighborhood: 'Miraflores',
        profilePhotoUrl: undefined,
        acceptTerms: true,
        acceptPrivacy: true,
        acceptSafetyRules: true,
      });
    });

    expect(refreshSessionMock).toHaveBeenCalled();
    expect(await screen.findByText('Perfil actualizado')).toBeInTheDocument();
    expect(persistToastMock).not.toHaveBeenCalled();
  });

  it('shows an error toast when profile update fails', async () => {
    vi.mocked(updateCurrentUserProfile).mockRejectedValue(
      new Error('No fue posible actualizar el perfil.'),
    );

    render(<ProfileOnboardingForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Editar perfil' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(
      await screen.findByText('No fue posible actualizar el perfil.'),
    ).toBeInTheDocument();
  });

  it('keeps avatar upload isolated from profile update flow', async () => {
    vi.mocked(uploadCurrentUserProfilePhoto).mockResolvedValue({
      id: 'user-1',
      profilePhotoUrl: 'https://example.com/avatar.jpg',
    } as never);
    refreshSessionMock.mockResolvedValue(undefined);

    render(<ProfileOnboardingForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Subir imagen' }));

    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');

    if (!input) {
      throw new Error('No se encontro el input de archivo del avatar.');
    }

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar avatar' }));

    await waitFor(() => {
      expect(uploadCurrentUserProfilePhoto).toHaveBeenCalledWith('access-token', file);
    });

    expect(refreshSessionMock).toHaveBeenCalled();
  });
});
