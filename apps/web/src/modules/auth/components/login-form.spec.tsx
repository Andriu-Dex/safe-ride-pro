import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../lib/auth-api';
import { LoginForm } from './login-form';

const replaceMock = vi.fn();
const signInMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
  useSearchParams: () => ({
    get: () => null,
  }),
}));

vi.mock('../hooks/use-auth', () => ({
  useAuth: () => ({
    signIn: signInMock,
    isSigningIn: false,
  }),
}));

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits credentials and redirects to the dashboard', async () => {
    signInMock.mockResolvedValue(undefined);

    render(<LoginForm />);

    const user = userEvent.setup();

    await user.clear(screen.getByPlaceholderText('tu-correo@institucion.edu'));
    await user.type(screen.getByPlaceholderText('tu-correo@institucion.edu'), 'nuevo-admin@uta.edu.ec');
    await user.clear(screen.getByPlaceholderText('Ingresa tu contraseña'));
    await user.type(screen.getByPlaceholderText('Ingresa tu contraseña'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith({
        email: 'nuevo-admin@uta.edu.ec',
        password: 'Password123!',
      });
    });

    expect(replaceMock).toHaveBeenCalledWith('/dashboard');
  });

  it('shows the API error message when sign in fails', async () => {
    signInMock.mockRejectedValue(new ApiError('Credenciales invalidas.', 401));

    render(<LoginForm />);

    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('tu-correo@institucion.edu'), 'nuevo-admin@uta.edu.ec');
    await user.type(screen.getByPlaceholderText('Ingresa tu contraseña'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(await screen.findByText('Credenciales invalidas.')).toBeInTheDocument();
  });
});
