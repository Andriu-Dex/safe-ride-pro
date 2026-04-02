import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, forgotPassword } from '../lib/auth-api';
import { ForgotPasswordForm } from './forgot-password-form';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

vi.mock('../lib/auth-api', async () => {
  const actual = await vi.importActual<typeof import('../lib/auth-api')>('../lib/auth-api');

  return {
    ...actual,
    forgotPassword: vi.fn(),
  };
});

describe('ForgotPasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to reset-password with the development code when available', async () => {
    vi.mocked(forgotPassword).mockResolvedValue({
      message: 'Si existe una cuenta activa con ese correo, enviamos instrucciones para restablecer la contrasena.',
      deliveryChannel: 'development_preview',
      resetCode: '123456',
    });

    render(<ForgotPasswordForm />);

    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Correo institucional'), 'usuario@uta.edu.ec');
    await user.click(screen.getByRole('button', { name: 'Enviar codigo' }));

    await waitFor(() => {
      expect(forgotPassword).toHaveBeenCalledWith('usuario@uta.edu.ec');
    });

    expect(replaceMock).toHaveBeenCalledWith(
      '/reset-password?email=usuario%40uta.edu.ec&sent=1&code=123456',
    );
  });

  it('redirects to reset-password without prefilled code when the email was delivered for real', async () => {
    vi.mocked(forgotPassword).mockResolvedValue({
      message: 'Si existe una cuenta activa con ese correo, enviamos instrucciones para restablecer la contrasena.',
      deliveryChannel: 'email',
    });

    render(<ForgotPasswordForm />);

    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Correo institucional'), 'usuario@uta.edu.ec');
    await user.click(screen.getByRole('button', { name: 'Enviar codigo' }));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(
        '/reset-password?email=usuario%40uta.edu.ec&sent=1',
      );
    });
  });

  it('shows the API error message when the request fails', async () => {
    vi.mocked(forgotPassword).mockRejectedValue(
      new ApiError('No fue posible enviar el codigo de recuperacion.', 429),
    );

    render(<ForgotPasswordForm />);

    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Correo institucional'), 'usuario@uta.edu.ec');
    await user.click(screen.getByRole('button', { name: 'Enviar codigo' }));

    expect(
      await screen.findByText('No fue posible enviar el codigo de recuperacion.'),
    ).toBeInTheDocument();
  });
});
